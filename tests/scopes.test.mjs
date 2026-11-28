import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHandler,connectionOptions,upstreamInventory,ROUTE} from '../dist/index.js';
const req=q=>new Request('http://dsh.test'+ROUTE+'?'+q);
const config={bank:'project::one',globalBank:'global::one'};
test('joint search preserves identical IDs with explicit source; detail never fans out',async()=>{
 const calls=[]; const h=createHandler(async path=>{calls.push(path);return {items:[{id:'same',text:'中文'}],total:1};},config);
 const body=await (await h(req('op=list&scope=both&q=中文'))).json();
 assert.deepEqual(body.data.items.map(x=>x._source.scope),['project','global']);assert.equal(calls.length,2);
 assert.ok(calls[0].includes('project%3A%3Aone'));assert.ok(calls[1].includes('global%3A%3Aone'));
 calls.length=0;await h(req('op=memory&scope=global&id=same&bank=other&endpoint=http://evil.test'));assert.equal(calls.length,1);assert.match(calls[0],/global%3A%3Aone\/memories\/same$/);
 assert.equal((await h(req('op=memory&scope=both&id=same'))).status,400);
 assert.equal((await h(req('op=graph&scope=bogus'))).status,400);
});
test('missing global library is partial, not empty-success nor auto-created',async()=>{
 const calls=[];const h=createHandler(async path=>{calls.push(path);if(path.includes('global%3A'))throw Object.assign(new Error('private error'),{status:404});return {items:[{id:'p'}],total:1};},config);
 const b=await (await h(req('op=list&scope=both'))).json();assert.equal(b.data.partial,true);assert.equal(b.data.items.length,1);assert.match(b.data.sources[1].error,/未创建/);assert.ok(calls.every(p=>p.includes('/memories/list')));
});
test('both libraries offline returns two explicit failures',async()=>{
 const b=await (await createHandler(async()=>{throw Error('secret');},config)(req('op=list&scope=both'))).json();assert.equal(b.data.sources.filter(s=>!s.ok).length,2);assert.equal(b.data.partial,true);assert.ok(!JSON.stringify(b).includes('secret'));
});
test('diagnostics read allowlist only and redact upstream configuration',async()=>{
 let reads=0,lists=0;const manager={async listPlugins(){lists++;return [{moduleName:'@vectorize-io/hindsight-coding-agents/dsh',enabled:true,fiberPhase:'active',diagnostic:'TOKEN_PRIVATE',config:{apiToken:'TOKEN_PRIVATE'}}];},async listBundles(){lists++;return [{name:'@vectorize-io/hindsight-coding-agents',version:'0.8.8',installed:true,source:'TOKEN_PRIVATE'}];}};
 const h=createHandler(async path=>{reads++;assert.ok(path==='/health'||path.endsWith('/stats'));return {status:'healthy',total_nodes:10,apiToken:'TOKEN_PRIVATE'};},config,()=>upstreamInventory(manager));
 const res=await h(req('op=diagnostics'));const body=await res.json();assert.equal(reads,3);assert.equal(lists,2);assert.equal(body.data.writeEnabled,false);assert.equal(body.data.automaticDualInjection,false);assert.equal(body.data.projectBinding,'configured');assert.ok(!JSON.stringify(body).includes('TOKEN_PRIVATE'));assert.equal(body.data.upstream.entries.length,1);
});
test('global and project binding must not alias and endpoints stay loopback',()=>{
 assert.throws(()=>connectionOptions({bank:'same',globalBank:'same'}));
 for(const endpoint of ['http://localhost:9077','http://127.0.0.1:9077/?token=private','http://127.0.0.1:9077/#x','http://127.0.0.1:9077/a','http://a:b@127.0.0.1:9077'])assert.throws(()=>connectionOptions({endpoint}));
});
test('client bundle renders the setup view without activation IO', async () => {
 const dist = await readFile('dist/client.js','utf8');
 assert.match(dist, /安装与连接检查/);
 assert.match(dist, /项目库是显式绑定的配置/);
 assert.match(dist, /本机自动记忆按会话所在项目采集/);
});

test('host overwrites forged source for every list scope',async()=>{
 for(const scope of ['project','global','both']){
  const h=createHandler(async()=>({items:[{id:'same',_source:{scope:'bogus',bank:'attacker'}}],total:1}),config);
  const b=await (await h(req('op=list&scope='+scope))).json();
  assert.deepEqual(b.data.items.map(x=>x._source.scope),scope==='both'?['project','global']:[scope]);
  assert.ok(b.data.items.every(x=>x._source.bank!=='attacker'));
 }
});
test('exact dot segments are rejected with no backend read; encoded URL remains scoped',async()=>{
 let reads=0;const h=createHandler(async()=>{reads++;return {};},config);
 for(const op of ['memory','page'])for(const id of ['.','..'])assert.equal((await h(req(new URLSearchParams({op,id}).toString()))).status,400);
 assert.equal(reads,0);
 for(const bank of ['.','..']){assert.throws(()=>connectionOptions({bank}));assert.throws(()=>connectionOptions({globalBank:bank}));}
 let path;await createHandler(async p=>{path=p;return {};},config)(req('op=memory&id='+encodeURIComponent('legal/name')));
 assert.equal(new URL(path,'http://127.0.0.1:9077').pathname,'/v1/default/banks/project%3A%3Aone/memories/legal%2Fname');
});
test('health arbitrary text is not exposed as status',async()=>{
 const h=createHandler(async()=>({status:'PRIVATE_RESPONSE_TEXT'}),config);
 for(const op of ['status','diagnostics']){const b=await (await h(req('op='+op))).json();assert.equal(op==='status'?b.data.status:b.data.health.status,'unknown');assert.ok(!JSON.stringify(b).includes('PRIVATE_RESPONSE_TEXT'));}
});
test('client single scope ignores forged item metadata on click', async () => {
 const { mountClient, walk } = await import('./harness.mjs');
 for (const scope of ['project', 'global', 'both']) {
  const forged = scope === 'project' ? 'global' : 'project';
  const mounted = mountClient({ scope, data: { value: { items: [{ id: 'same', text: 'spoof', _source: { scope: forged } }], total: 1 } } });
  const card = walk(mounted.render()).find(node => node.props && node.props.className === 'card');
  assert.ok(card, 'expected a memory card');
  card.props.onClick();
  assert.equal(mounted.values[8].scope, scope === 'both' ? forged : scope);
 }
});

test('project picker excludes the configured global bank and its old selection cannot alias both scopes', async () => {
  const paths = [];
  const handler = createHandler(async pathname => {
    if (pathname.startsWith('/v1/default/banks?')) {
      return { banks: [{ bank_id: 'coding-agent::global' }, { bank_id: 'coding-agent::example' }] };
    }
    paths.push(pathname);
    return { items: [{ id: 'sample' }], total: 1 };
  });
  const catalog = await (await handler(req('op=banks'))).json();
  assert.deepEqual(catalog.data.banks.map(bank => bank.id), ['coding-agent::example']);
  assert.equal(catalog.data.projectBank, 'coding-agent::default');

  const search = await (await handler(req('op=list&scope=both&bank=coding-agent::global&global=coding-agent::example'))).json();
  assert.deepEqual(search.data.items.map(item => [item._source.scope, item._source.bank]), [
    ['project', 'coding-agent::default'],
    ['global', 'coding-agent::global'],
  ]);
  assert.equal(new Set(paths).size, 2);
});

test('read-only memory history stays in the selected library and exposes only relevant fields',async()=>{
 const calls=[];
 const h=createHandler(async pathname=>{
  calls.push(pathname);
  if(pathname.includes('/documents/'))return {items:[{kind:'consolidation',created_at:'2026-11-28T00:00:00Z',
    facts_added:2,observations_updated:{count:3},task_payload:'PRIVATE'}]};
  return [{changed_at:'2026-11-28T00:00:00Z',previous_text:'旧结论',new_source_memory_ids:['evidence'],secret:'PRIVATE'}];
 },config);
 const observation=await(await h(req('op=observation-history&scope=global&id=old'))).json();
 assert.deepEqual(observation.data.items,[{date:'2026-11-28T00:00:00Z',previousText:'旧结论',newSources:1}]);
 const document=await(await h(req('op=document-history&scope=project&id=source'))).json();
 assert.deepEqual(document.data.items,[{kind:'consolidation',date:'2026-11-28T00:00:00Z',factsAdded:2,factsRemoved:0,observationsChanged:3}]);
 assert.deepEqual(calls,['/v1/default/banks/global%3A%3Aone/memories/old/history','/v1/default/banks/project%3A%3Aone/documents/source/history?limit=20']);
 assert.equal((await h(req('op=document-history&scope=both&id=source'))).status,400);
 assert.equal((await h(req('op=observation-history&id=..'))).status,400);
});
