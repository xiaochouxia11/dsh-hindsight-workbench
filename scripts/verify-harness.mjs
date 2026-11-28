import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const launcher = path.resolve(process.argv[2]);
assert.ok(process.env.npm_execpath, 'Run via npm run verify:harness -- path/to/dsh/lib/bin.js');
const temp = await realpath(tmpdir());
const root = await mkdtemp(path.join(temp, 'hindsight-harness-'));
const appHome = path.join(root, '验收 工作区');
await mkdir(appHome);
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(?:DSH_|HINDSIGHT_|DEEPSEEK_|OPENAI_)/.test(key)) delete env[key];
}
Object.assign(env, {
  DSH_HOME: appHome,
  HINDSIGHT_CONFIG: path.join(root, 'collector.json'),
  HINDSIGHT_LOG_FILE: path.join(root, 'collector.log'),
  HINDSIGHT_DIAG_FILE: path.join(root, 'collector.jsonl'),
  TMPDIR: root, TMP: root, TEMP: root,
});
const backend = 'http://127.0.0.1:1';
const patch = path.join(root, 'offline.json');
await writeFile(patch, JSON.stringify([{ id: 'hindsight-workbench-host', config: { endpoint: backend } }]));
await writeFile(env.HINDSIGHT_CONFIG, JSON.stringify({
  serverMode: 'self-hosted', apiUrl: backend, autoInject: 'none', retainSessions: true,
  autoUpdate: false, autoSeed: false, codebaseSurvey: false, manageBankConfig: false, gitIngest: 'none',
}));

const dsh = args => execFileSync(process.execPath, [launcher, ...args], {env, stdio: 'inherit', timeout: 150_000});
let host;
let finished;
let startupLog = '';

async function stop() {
  if (!host || host.exitCode !== null || host.signalCode !== null) return;
  host.kill();
  await Promise.race([finished, sleep(2000)]);
  if (host.exitCode === null && host.signalCode === null) host.kill('SIGKILL');
  await finished;
}

async function openHost() {
  startupLog = '';
  host = spawn(process.execPath, [launcher, '--profile', 'web', '--patch', patch, '--no-open', '--host', '127.0.0.1', '--port', '0'], {env});
  finished = once(host, 'exit');
  host.stdout.on('data', chunk => { startupLog = (startupLog + chunk).slice(-20000); });
  host.stderr.on('data', chunk => { startupLog = (startupLog + chunk).slice(-20000); });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && host.exitCode === null) {
    const address = startupLog.match(/dsh web:s+(http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/)?.[1];
    if (address) {
      const link = new URL(address);
      const login = await fetch(link, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
      assert.ok(cookie, 'Harness did not issue its local web session');
      return async (route, options = {}) => {
        const response = await fetch(new URL('/api/hindsight-workbench' + route, link.origin), {
          ...options, signal: AbortSignal.timeout(5000),
          headers: {cookie, ...options.headers},
        });
        const payload = await response.json();
        assert.equal(response.status, 200, JSON.stringify(payload));
        return payload.data;
      };
    }
    await sleep(100);
  }
  throw new Error('Harness web failed to start: ' + startupLog.replace(/([?&]token=)[^\s]+/gi, '$1[redacted]'));
}

try {
  const [archive] = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts',
    '--pack-destination', root, '--json'], { encoding: 'utf8', timeout: 30_000 }));
  dsh(['plugin', '--profile', 'web', 'add', path.join(root, archive.filename), '--registry=https://registry.npmjs.org']);
  const installed = path.join(appHome, 'profiles', 'web', 'node_modules', 'dsh-hindsight-workbench');
  assert.equal(JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8')).version, archive.version);

  const first = await openHost();
  const diagnostic = await first('?op=diagnostics');
  assert.equal(diagnostic.upstream.version, archive.version);
  assert.equal(diagnostic.upstream.entries.length, 1);
  assert.equal(diagnostic.upstream.entries[0].phase, 'active');
  assert.equal(diagnostic.endpoint, backend);
  const notesRoute = '/notes?scope=global';
  const initial = await first(notesRoute);
  assert.deepEqual(initial.items, []);
  await first(notesRoute, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hindsight-workbench': '1', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ action: 'save', revision: initial.revision, id: null, type: 'preference', title: '换机验收', content: '保留中文长期笔记' }),
  });
  assert.deepEqual(await first('/learning?scope=global'), { entries: [], reviews: [] });
  await stop();

  const reopened = await openHost();
  const restored = await reopened(notesRoute);
  assert.equal(restored.items.length, 1);
  assert.equal(restored.items[0].content, '保留中文长期笔记');
  console.log('Verified on ' + process.platform + ' ' + process.arch + ': official clean install, single collector, and offline Unicode notes after restart.');
} finally {
  await stop();
  assert.equal(path.dirname(root), temp);
  assert.match(path.basename(root), /^hindsight-harness-[a-z0-9]+$/i);
  await rm(root, { recursive: true, force: true });
}
