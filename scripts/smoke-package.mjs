// Run from the bundle root: npm run smoke:package
// Uses a disposable npm project and cache, never the active DSH profile.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = process.cwd();
const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
assert.ok(manifest.dsh?.bundle?.patch, 'Run this test from the DSH bundle root');
const tempRoot = await realpath(tmpdir());
const sandbox = await mkdtemp(join(tempRoot, 'hindsight-package-smoke-'));
function npm(args, cwd) {
  assert.ok(process.env.npm_execpath, 'Run with npm run smoke:package');
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], {cwd, stdio:'inherit', env:{...process.env,
    npm_config_ignore_scripts:'true',
    npm_config_audit:'false', npm_config_fund:'false'}});
}
try {
  npm(['pack', '--ignore-scripts', '--silent', '--pack-destination', sandbox], source);
  const archives = (await readdir(sandbox)).filter(file => file.endsWith('.tgz'));
  assert.equal(archives.length, 1, 'Expected one freshly packed archive');
  await writeFile(join(sandbox, 'package.json'), JSON.stringify({name:'workbench-smoke-consumer',private:true,type:'module'}));
  npm(['install', '--prefer-offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', './' + archives[0]], sandbox);
  const installed = join(sandbox, 'node_modules', ...manifest.name.split('/'));
  const installedManifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(installedManifest.version, manifest.version);
  assert.deepEqual(await readdir(join(installed, 'dist')).then(files => files.sort()), ['build.json','client.js','index.js']);
  const guide = new TextDecoder('utf-8',{fatal:true}).decode(await readFile(join(installed, 'docs', 'INSTALL.zh-CN.md')));
  assert.match(guide, /首次安装/);
  const patch = new TextDecoder('utf-8',{fatal:true}).decode(await readFile(join(installed, 'cordis.patch.yml')));
  assert.match(patch, /"id"\s*:\s*"hindsight"/);
  assert.match(patch, /hindsight-memory-host/);
  const upstreamRoot = join(sandbox, 'node_modules', '@vectorize-io', 'hindsight-coding-agents');
  const upstreamManifest = JSON.parse(await readFile(join(upstreamRoot, 'package.json'), 'utf8'));
  assert.equal(upstreamManifest.version, '0.8.8');
  assert.ok(upstreamManifest.exports?.['./dsh'], 'upstream must export the dsh entry point');
  await readFile(join(upstreamRoot, 'dist', 'dsh.js'));
  assert.equal(manifest.dependencies['@vectorize-io/hindsight-coding-agents'], '0.8.8');
  await writeFile(join(sandbox, 'check.mjs'), `
    import assert from 'node:assert/strict';
    const name = ${JSON.stringify(manifest.name)};
    const api = await import(name);
    assert.equal(typeof api.apply, 'function');
    assert.ok(import.meta.resolve(name + '/client').endsWith('/dist/client.js'));
    const guide = new URL('../docs/ACCEPTANCE.zh-CN.md', import.meta.resolve(name));
    const {readFile} = await import('node:fs/promises');
    assert.match(new TextDecoder('utf-8',{fatal:true}).decode(await readFile(guide)), /发布门/);
    const registry = new Map([['/unrelated', {name:'unrelated fixture'}]]);
    let dispose;
    api.apply({
      effect(fn) { dispose = fn(); },
      connection:{fetch:{register(route) {
        assert.ok(!registry.has(route.path));
        registry.set(route.path,route);
        return () => { registry.delete(route.path); };
      }}},
    }, {bank:'synthetic-project', globalBank:'synthetic-global'});
    assert.deepEqual(registry.get(api.ROUTE)?.methods,['GET']);
    await dispose();
    assert.deepEqual([...registry.keys()],['/unrelated']);
    const response = await api.createHandler(async () => {throw new Error('offline smoke');})(new Request('http://dsh.test' + api.ROUTE + '?op=stats'));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'BACKEND_UNAVAILABLE');
  `);
  execFileSync(process.execPath, ['check.mjs'], {cwd:sandbox,stdio:'inherit'});
  const sentinel = join(sandbox, 'unrelated-fixture.txt');
  await writeFile(sentinel, 'unrelated fixture\n');
  npm(['uninstall', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', manifest.name], sandbox);
  await assert.rejects(readFile(join(installed, 'package.json')), {code:'ENOENT'});
  assert.equal(await readFile(sentinel, 'utf8'), 'unrelated fixture\n');
  console.log('Offline package install/uninstall and stub route lifecycle passed (not a DSH host activation or rollback test).');
} finally {
  assert.match(sandbox.slice(tempRoot.length + 1), /^hindsight-package-smoke-[A-Za-z0-9]+$/);
  await rm(sandbox, {recursive:true,force:true});
}
