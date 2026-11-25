import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler, readLocal, ROUTE } from '../dist/index.js';

// Exercises the real HTTP transport against synthetic banks. Explicit bindings are only
// a baseline for validating the transport, not evidence of automatic project selection.
test('loopback transport keeps two explicitly bound project views and global details separate', async () => {
  const calls = [];
  const banks = new Map([
    ['test-project-a', '甲项目'], ['test-project-b', '乙项目'], ['test-global', '共同记忆'],
  ]);
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    const route = /^\/v1\/default\/banks\/([^/]+)\/memories\/(list|same)$/.exec(path);
    const bank = route && decodeURIComponent(route[1]);
    calls.push([req.method, bank, route?.[2]]);
    const text = banks.get(bank);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!text || req.method !== 'GET') {
      res.writeHead(404).end('{}');
      return;
    }
    const item = { id:'same', text };
    res.end(JSON.stringify(route[2] === 'list' ? {items:[item],total:1} : item));
  });
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const a = createHandler(readLocal, {endpoint, bank:'test-project-a', globalBank:'test-global'});
    const b = createHandler(readLocal, {endpoint, bank:'test-project-b', globalBank:'test-global'});
    const req = params => new Request(`http://dsh.test${ROUTE}?${params}`);
    const query = async (handler, params) => {
      const response = await handler(req(params));
      assert.equal(response.status, 200);
      return (await response.json()).data;
    };
    const results = await Promise.all([a,b].map(handler => query(handler, 'op=list&scope=both')));
    assert.deepEqual(results.map(r => r.items.map(i => [i.text,i._source.scope])), [
      [['甲项目','project'],['共同记忆','global']], [['乙项目','project'],['共同记忆','global']],
    ]);
    assert.equal((await query(a, 'op=memory&scope=project&id=same&bank=test-project-b')).text, '甲项目');
    assert.equal((await query(b, 'op=memory&scope=global&id=same')).text, '共同记忆');
    assert.equal(calls.length, 6);
    assert.ok(calls.every(([method]) => method === 'GET'));
  } finally {
    await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
