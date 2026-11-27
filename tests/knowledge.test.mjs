import assert from 'node:assert/strict';
import test from 'node:test';
import {createKnowledgeHandler, KNOWLEDGE_ROUTE} from '../dist/index.js';

const scope = 'http://desktop.test' + KNOWLEDGE_ROUTE;
const id = 'hbm-doc-10000000-0000-4000-8000-000000000000';
const bank = 'hbm-kb-本机知识';
const auth = {'content-type':'application/json','x-hindsight-workbench':'1'};
const req = (op, {body, query, headers = auth, method = body ? 'POST' : 'GET'} = {}) =>
  new Request(scope + '?' + new URLSearchParams({op, ...query}), {
    method, headers, body:body && JSON.stringify(body),
  });

test('knowledge route accepts only its fixed operations and scopes', async () => {
  let dispatched = 0;
  const handle = createKnowledgeHandler(async () => { dispatched++; return {}; });
  assert.equal((await handle(req('delete', {body:{bank}}))).status,400);
  assert.equal((await handle(req('create', {body:{name:'test'},headers:{'content-type':'application/json'}}))).status,403);
  assert.equal((await handle(req('create', {body:{name:'test'},headers:{...auth,origin:'https://other.example'}}))).status,403);
  assert.equal((await handle(req('create', {body:{name:'bad/name'}}))).status,400);
  assert.equal((await handle(req('search', {body:{bank:'coding-agent::global',query:'test'}}))).status,400);
  assert.equal((await handle(req('source', {query:{bank,id:'../private'}}))).status,400);
  assert.equal(dispatched,0);
});

test('native ingestion reports acceptance and waits for a separate ready document status', async () => {
  const calls=[];
  const handle=createKnowledgeHandler(async (path, signal, connection, options) => {
    calls.push([path,options]);
    if(path.endsWith('/ingest')) return {document_ids:[id]};
    if(path.endsWith('/file')) return '原文 😀';
    return {status:'ready',passage_count:1,error:'internal detail'};
  });
  const queued=await (await handle(req('ingest',{body:{bank,documentId:id,title:'测试',content:'原文 😀'}}))).json();
  assert.equal(queued.data.status,'pending');
  assert.deepEqual(calls[0][1].body,{items:[{document_id:id,filename:'测试.md',text:'原文 😀'}],async:true});
  const indexed=await (await handle(req('document',{query:{bank,id}}))).json();
  assert.deepEqual(indexed.data,{id,status:'ready',passages:1});
  const source=await (await handle(req('source',{query:{bank,id}}))).json();
  assert.deepEqual(source.data,{text:'原文 😀',truncated:false});
  assert.ok(calls.every(([path])=>path.includes(encodeURIComponent(bank))));
});
