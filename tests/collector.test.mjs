import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

function git(project, ...args) {
  return execFileSync('git', ['-C', project, ...args], { stdio: 'ignore' });
}

test('the packaged collector recalls only the new session’s bound project', async t => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'hbm-collector-'));
  const env = { ...process.env };
  t.after(async () => {
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    await rm(sandbox, { recursive: true, force: true });
  });
  for (const key of Object.keys(process.env)) if (key.startsWith('HINDSIGHT_')) delete process.env[key];
  Object.assign(process.env, {
    DSH_HOME: sandbox, DSH_HINDSIGHT_RETAIN_TRANSCRIPTS: '1',
    HINDSIGHT_CONFIG: path.join(sandbox, 'collector.json'),
    HINDSIGHT_LOG_FILE: path.join(sandbox, 'collector.log'),
    HINDSIGHT_DIAG_FILE: path.join(sandbox, 'diagnostics.jsonl'),
    TMPDIR: sandbox, TEMP: sandbox, TMP: sandbox,
  });
  const first = path.join(sandbox, 'first', 'same-name');
  const second = path.join(sandbox, 'second', 'same-name');
  const mapped = path.join(sandbox, 'mapped');
  const alias = path.join(sandbox, 'alias');
  for (const project of [first, second, mapped]) await mkdir(project, { recursive: true });
  await symlink(first, alias, process.platform === 'win32' ? 'junction' : 'dir');

  const calls = [];
  const buckets = new Map();
  const backend = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://fixture').pathname;
    const bank = decodeURIComponent(pathname.split('/')[4] || '');
    let body = '';
    for await (const chunk of request) body += chunk;
    let result = {};
    if (pathname.endsWith('/memories/recall')) {
      calls.push({ kind: 'recall', bank });
      result = { results: (buckets.get(bank) || []).map(text => ({ text })) };
    } else if (request.method === 'POST' && pathname.endsWith('/memories')) {
      const content = JSON.parse(body).items[0].content;
      const token = content.match(/synthetic-[AB]/)?.[0];
      if (token) buckets.set(bank, [token]);
      calls.push({ kind: 'retain', bank });
      result = { operation_id: randomUUID() };
    } else if (pathname.endsWith('/pages/tree')) result = { roots: [] };
    else if (pathname.endsWith('/pages')) result = { pages: [] };
    else if (pathname.endsWith('/stats')) result = { total_nodes: 1 };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(result));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  t.after(() => { backend.closeAllConnections(); backend.close(); });
  await writeFile(process.env.HINDSIGHT_CONFIG, JSON.stringify({
    serverMode: 'self-hosted', apiUrl: 'http://127.0.0.1:' + backend.address().port,
    autoInject: 'recall', retainSessions: true,
    autoUpdate: false, autoSeed: false, autoReflect: false, codebaseSurvey: false, manageBankConfig: false,
    gitIngest: 'none', mapPathToBank: { [mapped]: 'coding-agent::explicit-fixture' },
  }));
  const { apply } = await import('../dist/collector.js');
  const hooks = new Map();
  apply({ on(name, hook) { hooks.set(name, hook); }, inject() {} });
  const message = text => ({ role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } });
  const session = (cwd, events = []) => ({
    session: { header: { cwd, id: randomUUID() }, snapshotEvents: () => events },
  });
  const recall = async cwd => {
    const decision = await hooks.get('agent/pre-step')({
      agent: session(cwd), signal: new AbortController().signal,
    }, async () => ({ kind: 'enter', messages: [message('Lookup the saved project code')] }));
    return decision.messages.flatMap(item => item.content).map(block => block.text).join('\n');
  };
  const retain = async (cwd, token) => {
    const before = calls.length;
    const agent = session(cwd, [
      { type: 'user/message', data: message(token) },
      { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Ack' }] } } },
    ]);
    await hooks.get('agent/turn-stopping')({ agent });
    for (let i = 0; i < 40 && !calls.slice(before).some(call => call.kind === 'retain'); i++) await delay(25);
  };
  await retain(first, 'synthetic-A');
  await retain(second, 'synthetic-B');
  const banks = Array.from(buckets.keys());
  assert.equal(banks.length, 2);
  assert.ok(banks.every(bank => /^coding-agent::workspace-[a-f0-9]{32}$/.test(bank)));
  assert.match(await recall(first), /synthetic-A/);
  assert.doesNotMatch(await recall(first), /synthetic-B/);
  assert.match(await recall(second), /synthetic-B/);
  assert.doesNotMatch(await recall(second), /synthetic-A/);
  assert.match(await recall(alias), /synthetic-A/);
  await recall(mapped);
  assert.ok(calls.some(call => call.bank === 'coding-agent::explicit-fixture'));
  const before = calls.length;
  await recall(undefined);
  await recall('relative/path');
  await recall(path.join(sandbox, 'missing'));
  assert.equal(calls.length, before);

  await t.test('default hook remembers only selected rules and recalls them in a new session', async () => {
    delete process.env.DSH_HINDSIGHT_RETAIN_TRANSCRIPTS;
    const before = calls.filter(call => call.kind === 'retain').length;
    const done = () => ({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Ack' }] } } });
    for (const prompt of ['以后验收格式：markdown 清单', '请这份报告使用 private-note']) {
      await hooks.get('agent/turn-stopping')({ agent:session(first, [
        { type: 'user/message', data: message(prompt) }, done(),
      ]) });
    }
    const replay = async (cwd, prompt) => {
      const value = await hooks.get('agent/pre-step')({ agent: session(cwd), signal: new AbortController().signal },
        async () => ({ kind: 'enter', messages: [message(prompt)] }));
      return value.messages.filter(item => item.source.kind !== 'user').flatMap(item => item.content.map(block => block.text)).join('\n');
    };
    assert.match(await replay(first, '检查验收格式'), /markdown 清单/);
    assert.doesNotMatch(await replay(second, '检查验收格式'), /markdown 清单/);
    assert.doesNotMatch(await replay(first, '查找 private-note'), /private-note/);
    assert.equal(calls.filter(call => call.kind === 'retain').length, before);
    process.env.DSH_HINDSIGHT_RETAIN_TRANSCRIPTS = '1';
  });

  await t.test('a linked Git worktree shares its main checkout’s library', async linked => {
    try { git(sandbox, '--version'); }
    catch { return linked.skip('git is unavailable'); }
    const main = path.join(sandbox, 'main-checkout');
    const worktree = path.join(sandbox, 'linked-checkout');
    await mkdir(main);
    git(main, 'init');
    git(main, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
      '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture');
    git(main, 'worktree', 'add', '--detach', worktree);
    const beforeRetain = calls.length;
    await retain(main, 'synthetic-A');
    await recall(worktree);
    const mocked = calls.slice(beforeRetain);
    assert.ok(mocked.some(call => call.kind === 'retain'));
    assert.ok(mocked.some(call => call.kind === 'recall'));
    assert.equal(new Set(mocked.map(call => call.bank)).size, 1);
  });
});
