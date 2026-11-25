import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, symlink, realpath, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import test from 'node:test';

import { createProjectRoute } from '../src/project-routing.mjs';
import { createIsolatedMemoryAdapter } from '../src/isolated-memory-adapter.mjs';

async function projects(t) {
  const root = await mkdtemp(join(tmpdir(), 'isolated-routing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const a = join(root, 'one', 'same');
  const b = join(root, 'two', 'same');
  await Promise.all([mkdir(a, { recursive: true }), mkdir(b, { recursive: true })]);
  return { root, a, b };
}

function host(projectRoot) {
  let identity = Object.freeze({ projectRoot, generation: 0 });
  return {
    getProjectIdentity: () => identity,
    set: (projectRoot, generation) => { identity = projectRoot ? Object.freeze({ projectRoot, generation }) : null; },
  };
}

async function mockServer(t, options = {}) {
  const globalBank = 'mock-global';
  const calls = [];
  const banks = new Map([[globalBank, 'shared']]);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    const match = /^\/mock\/([^/]+)\/(read|recall|retain)$/.exec(path);
    if (!match) return res.writeHead(404).end('{}');
    const bankId = decodeURIComponent(match[1]);
    const action = match[2];
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
    calls.push({ action, bankId, method: req.method, body });
    const reply = value => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
    if (action === 'retain' && req.method === 'POST' && bankId !== globalBank) {
      banks.set(bankId, body.content);
      return reply({ stored: true });
    }
    if (action === 'recall' && req.method === 'POST') {
      if (bankId === globalBank && options.hangGlobal) return;
      if (bankId === globalBank && options.failGlobal) return res.writeHead(503).end('{}');
      // Optional barrier lets the test hold responses until both sources or an identity change are observed.
      if (options.beforeRecall) await options.beforeRecall(bankId);
      return reply({ items: [{ id: 'same', text: banks.get(bankId), source: 'spoof' }] });
    }
    if (action === 'read' && req.method === 'GET') return reply({ id: 'same', text: banks.get(bankId) });
    return res.writeHead(405).end('{}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (bankId, kind, method, body, signal) => {
    const response = await fetch(`${origin}/mock/${encodeURIComponent(bankId)}/${kind}`, {
      method, body: body && JSON.stringify(body), signal,
    });
    if (!response.ok) throw new Error('Synthetic upstream failure');
    return response.json();
  };
  return {
    calls, globalBank,
    project: {
      read: ({ bankId, signal }) => request(bankId, 'read', 'GET', undefined, signal),
      recall: ({ bankId, query, limit, signal }) => request(bankId, 'recall', 'POST', { query, limit }, signal),
      retain: ({ bankId, content, signal }) => request(bankId, 'retain', 'POST', { content }, signal),
    },
    recallGlobal: ({ query, limit, signal }) => request(globalBank, 'recall', 'POST', { query, limit }, signal),
  };
}

test('trusted canonical filesystem paths isolate same basenames and collapse aliases', async t => {
  assert.equal(typeof createProjectRoute, 'function', 'project route factory must exist');
  const { root, a, b } = await projects(t);
  const alias = join(root, 'alias');
  await symlink(a, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const aHost = host(a);
  const route = await createProjectRoute(aHost);
  const info = await route.assertCurrent();
  assert.match(info.bankId, /^dsh-project-v1-[\da-f]{64}$/);
  assert.equal(Object.isFrozen(info), true);
  assert.equal(info.canonicalPath, await realpath(a));
  aHost.set(alias + sep, 0);
  assert.strictEqual(await route.assertCurrent(), info);
  assert.notEqual((await (await createProjectRoute(host(b))).assertCurrent()).bankId, info.bankId);
  if (process.platform === 'win32') {
    const aCase = a[0] === a[0].toUpperCase() ? a[0].toLowerCase() + a.slice(1) : a[0].toUpperCase() + a.slice(1);
    assert.equal((await (await createProjectRoute(host(aCase.replaceAll('\\', '/')))).assertCurrent()).bankId, info.bankId);
    aHost.set(a.replace(/same$/u, 'SAME'), 0);
    assert.strictEqual(await route.assertCurrent(), info);
  }
});

test('missing eligibility, malformed root, or missing generation does not bind', async t => {
  assert.equal(typeof createProjectRoute, 'function');
  const { root, a } = await projects(t);
  const file = join(root, 'file');
  await writeFile(file, 'not a directory');
  const badRoots = ['same', join(root, 'missing'), `${a}\0`, file];
  if (process.platform === 'win32') badRoots.push('\\root-relative', 'C:drive-relative');
  for (const value of [null, { projectRoot: a }, ...badRoots.map(projectRoot => ({ projectRoot, generation: 0 }))]) {
    await assert.rejects(createProjectRoute({ getProjectIdentity: () => value }), { code: 'PROJECT_UNAVAILABLE' });
  }
});

test('observed identity drift irreversibly invalidates the route', async t => {
  assert.equal(typeof createProjectRoute, 'function');
  const { a, b } = await projects(t);
  const mock = await mockServer(t);
  const context = host(a);
  const route = await createProjectRoute(context);
  const adapter = createIsolatedMemoryAdapter({ route, ...mock });
  context.set(b, 0);
  await assert.rejects(adapter.retain({ content: 'never written' }), { code: 'PROJECT_CHANGED' });
  context.set(a, 0);
  await assert.rejects(adapter.recall({ query: 'never sent' }), { code: 'PROJECT_CHANGED' });
  assert.deepEqual(mock.calls, []);
  const second = await createProjectRoute(context);
  context.set(a, 2);
  await assert.rejects(second.assertCurrent(), { code: 'PROJECT_CHANGED' });
});

test('directory replacement at the same path invalidates an open route', async t => {
  const { a } = await projects(t);
  const route = await createProjectRoute(host(a));
  await rename(a, `${a}-original`);
  await mkdir(a);
  await assert.rejects(route.assertCurrent(), { code: 'PROJECT_CHANGED' });
});

test('same-basenamed projects use one route each for browser reads, dual recall and project-only retain over HTTP', async t => {
  assert.equal(typeof createIsolatedMemoryAdapter, 'function');
  const { a, b } = await projects(t);
  let recalls = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const mock = await mockServer(t, { beforeRecall: () => { if (++recalls === 2) release(); return barrier; } });
  const [ra, rb] = await Promise.all([a, b].map(projectRoot => createProjectRoute(host(projectRoot))));
  const [aa, ab] = [ra, rb].map(route => createIsolatedMemoryAdapter({ route, timeoutMs: 2000, ...mock }));
  const [idA, idB] = (await Promise.all([ra.assertCurrent(), rb.assertCurrent()])).map(info => info.bankId);
  const forged = { bankId: idB, projectRoot: b, scope: 'global', endpoint: 'http://example.invalid' };
  assert.deepEqual(await aa.retain({ content: 'alpha', ...forged }), { stored: true });
  await ab.retain({ content: 'beta' });
  assert.deepEqual(await aa.readWorkbench({ operation: 'memory', id: 'same', ...forged }), { id: 'same', text: 'alpha' });
  assert.deepEqual(await ab.readWorkbench({ operation: 'memory', id: 'same' }), { id: 'same', text: 'beta' });
  const hits = await aa.recall({ query: 'hello', ...forged });
  assert.deepEqual(hits.items.map(item => [item.text, item.source]), [['alpha', 'project'], ['shared', 'global']]);
  const hitsB = await ab.recall({ query: 'hello' });
  assert.deepEqual(hitsB.items.map(item => [item.text, item.source]), [['beta', 'project'], ['shared', 'global']]);
  assert.equal(hits.partial, false);
  assert.deepEqual(mock.calls.filter(c => c.action === 'retain').map(c => [c.bankId, c.body]), [
    [idA, { content: 'alpha' }], [idB, { content: 'beta' }],
  ]);
  assert.ok(mock.calls.filter(c => c.bankId === mock.globalBank).every(c => c.action === 'recall'));
  assert.throws(() => createIsolatedMemoryAdapter({ route: { assertCurrent: () => ({ bankId: idB }) }, ...mock }), TypeError);
  await assert.rejects(aa.readWorkbench({ operation: 'retain', id: 'same' }), { code: 'INVALID_INPUT' });
});

test('global timeout or upstream error preserves project recall with a bounded, tagged failure', async t => {
  assert.equal(typeof createIsolatedMemoryAdapter, 'function');
  const { a } = await projects(t);
  const route = await createProjectRoute(host(a));
  for (const [flags, code] of [[{ hangGlobal: true }, 'BACKEND_TIMEOUT'], [{ failGlobal: true }, 'BACKEND_UNAVAILABLE']]) {
    const mock = await mockServer(t, flags);
    const adapter = createIsolatedMemoryAdapter({ route, timeoutMs: 350, ...mock });
    await adapter.retain({ content: 'alpha' });
    const result = await adapter.recall({ query: 'hello' });
    assert.deepEqual(result.items.map(item => [item.text, item.source]), [['alpha', 'project']]);
    assert.deepEqual(result.sources, [{ source: 'project', ok: true }, { source: 'global', ok: false, code }]);
    assert.equal(result.partial, true);
  }
});

test('identity drift queued during filesystem verification prevents dispatch', async t => {
  const { a, b } = await projects(t);
  let reads = 0;
  const context = host(a);
  const route = await createProjectRoute({
    getProjectIdentity() {
      if (++reads === 4) queueMicrotask(() => context.set(b, 1));
      return context.getProjectIdentity();
    },
  });
  let calls = 0;
  const adapter = createIsolatedMemoryAdapter({
    route, recallGlobal() { calls++; }, project: { read() {}, retain() {}, recall() { calls++; } },
  });
  await assert.rejects(adapter.recall({ query: 'never dispatched' }), { code: 'PROJECT_CHANGED' });
  assert.equal(calls, 0);
});

test('post-dispatch identity drift distinguishes acknowledged and unknown retain outcomes', async t => {
  const { a, b } = await projects(t);
  for (const [acknowledged, expected] of [[true, 'PROJECT_CHANGED_AFTER_RETAIN'], [false, 'RETAIN_OUTCOME_UNKNOWN']]) {
    const context = host(a);
    const route = await createProjectRoute(context);
    let calls = 0;
    let actualBank;
    let retainSignal;
    const adapter = createIsolatedMemoryAdapter({
      route, timeoutMs: 50, recallGlobal() {}, project: {
        read() {}, recall() {}, retain({ bankId, signal }) {
          calls++;
          actualBank = bankId;
          retainSignal = signal;
          context.set(b, 1);
          return acknowledged ? { stored: true } : new Promise(() => {});
        },
      },
    });
    const initial = await route.assertCurrent();
    await assert.rejects(adapter.retain({ content: 'once' }), {
      code: expected, projectChanged: true, retainOutcome: acknowledged ? 'acknowledged' : 'unknown',
    });
    assert.equal(actualBank, initial.bankId);
    assert.equal(retainSignal.aborted, !acknowledged);
    await assert.rejects(adapter.retain({ content: 'never again' }), { code: 'PROJECT_CHANGED' });
    assert.equal(calls, 1);
  }
});

test('in-flight recall discards both sources if the host generation changes', async t => {
  assert.equal(typeof createIsolatedMemoryAdapter, 'function');
  const { a } = await projects(t);
  let start;
  let release;
  const arrived = new Promise(resolve => { start = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const mock = await mockServer(t, { beforeRecall: () => { start(); return barrier; } });
  const context = host(a);
  const route = await createProjectRoute(context);
  const adapter = createIsolatedMemoryAdapter({ route, timeoutMs: 1500, ...mock });
  const task = adapter.recall({ query: 'do not return' });
  try {
    await Promise.race([arrived, task]);
    context.set(a, 2);
  } finally { release(); }
  await assert.rejects(task, { code: 'PROJECT_CHANGED' });
});
