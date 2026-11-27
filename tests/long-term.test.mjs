import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createNotesHandler, createRecallHandler, NOTES_ROUTE, RECALL_ROUTE } from '../dist/index.js';

const headers = { 'content-type': 'application/json', 'x-hindsight-workbench': '1' };
const post = (url, input) => new Request(url, { method: 'POST', headers, body: JSON.stringify(input) });

test('long-term notes survive sessions and stay in the chosen library when archived and restored', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'hbm-notes-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const project = 'http://desktop.test' + NOTES_ROUTE + '?scope=project&bank=coding-agent%3A%3Aa';
  const global = 'http://desktop.test' + NOTES_ROUTE + '?scope=global';
  const another = project.replace('%3Aa', '%3Ab');
  const load = (handler, url) => handler(new Request(url)).then(response => response.json()).then(result => result.data);
  const save = { action: 'save', revision: null, id: null, type: 'preference', title: '用词偏好', content: '请用简体中文说明。' };
  let handler = createNotesHandler(directory);
  const saved = (await (await handler(post(project, save))).json()).data;
  assert.equal(saved.items.length, 1);
  assert.equal((await handler(post(project, save))).status, 409);
  handler = createNotesHandler(directory);
  assert.deepEqual(await load(handler, project), saved);
  assert.deepEqual((await load(handler, global)).items, []);
  assert.deepEqual((await load(handler, another)).items, []);
  const id = saved.items[0].id;
  const edit = (await (await handler(post(project, { ...save, id, revision: saved.revision, content: '更新为中英双语。' }))).json()).data;
  const archived = (await (await handler(post(project, { action: 'archive', id, revision: edit.revision }))).json()).data;
  assert.equal(archived.items[0].archived, true);
  const restored = (await (await handler(post(project, { action: 'restore', id, revision: archived.revision }))).json()).data;
  assert.equal(restored.items[0].archived, false);
  assert.equal(restored.items[0].content, '更新为中英双语。');
  assert.equal((await handler(new Request(project.replace('%3Aa', '%3Aglobal')))).status, 400);
});

test('semantic recall keeps source identity and does not dispatch to a missing global library', async () => {
  const calls = [];
  const handler = createRecallHandler(async (target, _signal, _options, request) => {
    calls.push([target, request]);
    if (target.includes('global')) throw Object.assign(new Error('missing'), { status: 404 });
    return request ? { results: [{ id: 'same', text: '合成结果', type: 'observation', metadata: { private: 'ignored' } }] } : {};
  });
  const url = 'http://desktop.test' + RECALL_ROUTE;
  const response = await handler(post(url, { scope: 'both', bank: 'coding-agent::a', query: '关联查询' }));
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.partial, true);
  assert.equal(data.sources[1].status, 404);
  assert.deepEqual(data.items.map(item => [item.text, item._source.bank, item.metadata]), [['合成结果', 'coding-agent::a', undefined]]);
  assert.equal(calls.filter(([target]) => target.endsWith('/memories/recall')).length, 1);
  assert.equal(calls.find(([, request]) => request)[1].body.query, '关联查询');
  assert.equal((await handler(post(url, { scope: 'both', bank: 'coding-agent::global', query: '查询' }))).status, 400);
});
