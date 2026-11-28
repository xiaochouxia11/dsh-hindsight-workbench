import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {targetFor,createHandler,connectionOptions,upstreamInventory,apply,ROUTE,KNOWLEDGE_ROUTE} from '../dist/index.js';
const req=(q,method='GET')=>new Request('http://dsh.test'+ROUTE+'?'+q,{method});
test('fixed GET allowlist rejects arbitrary operations and invalid inputs',()=>{
  assert.match(targetFor(new URLSearchParams('op=list&q=中文&offset=30')),/limit=30&offset=30&q=/);
  for(const q of ['op=delete','op=recall','op=list&offset=-1','op=memory'])assert.throws(()=>targetFor(new URLSearchParams(q)));
});
test('configuration remains local and has no URL credentials',()=>{
  assert.equal(connectionOptions({endpoint:'http://127.0.0.1:9090',bank:'example'}).port,'9090');
  for(const endpoint of ['https://example.com','http://example.com','http://u:p@127.0.0.1:9077','http://127.0.0.1/a'])assert.throws(()=>connectionOptions({endpoint}));
});
test('handler preserves Chinese and scopes configured bank',async()=>{
  let path;const handler=createHandler(async p=>{path=p;return {text:'中文原文'};},{bank:'example'});
  const res=await handler(req('op=list'));assert.equal(res.status,200);assert.match(path,/banks\/example\/memories\/list/);
  assert.equal((await res.json()).data.text,'中文原文');assert.equal(res.headers.get('cache-control'),'no-store');
  assert.equal((await handler(req('op=stats','POST'))).status,405);
});
test('disconnect, unsupported interface and UTF8 failure are separate',async()=>{
  for(const [error,status,code] of [[new Error('socket details'),503,'BACKEND_UNAVAILABLE'],[Object.assign(new Error('missing'),{status:404}),404,'BACKEND_UNAVAILABLE'],[Object.assign(new Error('响应不是有效 UTF-8'),{code:'UTF8_DECODE'}),503,'UTF8_DECODE']]){
    const res=await createHandler(async()=>{throw error;})(req('op=pages'));assert.equal(res.status,status);const body=await res.json();assert.equal(body.code,code);assert.ok(!JSON.stringify(body).includes('socket details'));
  }
});
test('host route is owned by context effect and disposed',async()=>{
  const routes = new Map();
  const disposers = [];
  apply({effect(fn){disposers.push(fn());},connection:{fetch:{register(route){routes.set(route.path, route);return () => routes.delete(route.path);}}}});
  assert.deepEqual(routes.get(ROUTE).methods, ['GET']);
  assert.deepEqual(routes.get(KNOWLEDGE_ROUTE).methods, ['GET','POST']);
  for (const dispose of disposers) await dispose();
  assert.equal(routes.size, 0);
});
test('client registers reversible sidebar and main page without touching unrelated panel',async()=>{
  let plugin;const registrations=[];const callbacks=[];const effects=[];let selected='other';
  const React={createElement:(type,props,...children)=>({type,props,children})};
  vm.runInNewContext(await readFile('dist/client.js','utf8'),{window:{__ModuleLoader__:{load(p){plugin=p.factory(()=>React);}}},URLSearchParams,fetch(){throw new Error('no request at activation');}});
  const ctx={effect(fn){effects.push(fn());},locale:{register(){return()=>{};},bind(){return key=>key;}},layout:{panelInfo:{getSnapshot:()=>({activePanelId:selected})},selectPanel(id){selected=id;}},slots:{inject(name,fn){callbacks.push(fn);},register(options,component){registrations.push({options,component});return()=>{};}}};
  plugin.apply(ctx);callbacks.forEach(fn=>fn());assert.equal(registrations.length,2);assert.equal(registrations[0].options.key,registrations[1].options.id);assert.equal(typeof registrations[1].component,'function');
  for(const fn of effects)await fn?.();assert.equal(selected,'other');
  selected=registrations[0].options.key;for(const fn of effects)await fn?.();assert.equal(selected,null);
});
test('manifest and insert-only patch export built files and unique IDs',async()=>{
  const pkg=JSON.parse(await readFile('package.json'));const patch=JSON.parse(await readFile('cordis.patch.yml'));
  assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');for(const op of patch){assert.deepEqual(Object.keys(op),['insert']);for(const entry of op.insert){assert.ok(entry.id.length>0);assert.ok(entry.name===pkg.name||entry.name===pkg.name+'/collector');}}
  assert.ok(patch.some(op=>op.insert.some(entry=>entry.name===pkg.name)));
  for(const key of ['.','./collector','./client','./icon'])assert.ok((await readFile(pkg.exports[key])).length);
});
