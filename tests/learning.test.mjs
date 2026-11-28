import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyInstruction, getLearning, recallLearning, recordLearning, reviewActions } from '../dist/learning.js';
import { createLearningHandler } from '../dist/index.js';

const bank = 'coding-agent::alpha';
const other = 'coding-agent::beta';
const globalBank = 'coding-agent::global';
const user = text => ({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type:'text', text }] } });

function operation(callId, name, command, exitCode, text = '') {
  return [
    { type: 'tool/call', data: { callId, name, arguments: JSON.stringify({ command }) } },
    { type: 'tool/result', data: { meta: { exitCode }, message: { source: { callId }, content: [{ type: 'text', text }] } } },
  ];
}

async function workspace(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'hbm-learning-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('automatically classify durable corrections and preferences and exclude temporary, quoted, or hypothetical examples', () => {
  assert.equal(classifyInstruction('我喜欢简洁的验收报告').kind, 'preference');
  assert.equal(classifyInstruction('这个项目统一用简体中文').scope, 'project');
  assert.equal(classifyInstruction('所有项目都用简体中文').scope, 'global');
  assert.equal(classifyInstruction('我一贯喜欢清单式验收报告').scope, 'global');
  assert.equal(classifyInstruction('以后所有项目都用简体中文').scope, 'global');
  assert.equal(classifyInstruction('以后这个项目的验收报告统一用表格').scope, 'project');
  assert.equal(classifyInstruction('不对，以后验收格式：清单').kind, 'correction');
  for (const input of [
    '不对，按钮往左移', '今后如果出现这个错误怎么办？', '假设以后全局都用表格',
    '请这份报告用表格', '请今天生成一份报告', '请只修改这个文件', '以后只在 test.js 禁用',
    '请记住 API key 1234', '请不要记住这个内容', '“以后都用这个例子”',
    '请分析这个片段\n以后统一这样处理',
  ]) assert.equal(classifyInstruction(input), null, input);
});

test('three independent sessions promote the repeated instruction, while same-topic correction replaces the old rule', async t => {
  const directory = await workspace(t);
  const remember = (session, text, target = bank) => recordLearning({ directory, bank:target, globalBank, session, events:[user(text)] });
  const repeated = '请运行冒烟测试再验收';
  await remember('s1', repeated);
  await remember('s1', repeated);
  await remember('s2', repeated);
  assert.deepEqual((await getLearning(bank, directory)).entries.map(row => [row.status, row.sources.length]), [['candidate', 2]]);
  await remember('s3', repeated);
  await remember('s4', '以后验收格式：表格');
  await remember('s5', '不对，以后验收格式：清单');
  await remember('s6', '所有项目都用简体中文');
  const entries = (await getLearning(bank, directory)).entries;
  assert.equal(entries.length, 2);
  assert.match(entries[0].previous, /表格/);
  assert.match(entries[0].text, /清单/);
  assert.equal(entries[1].status, 'durable');
  const recall = (prompt, target = bank) => recallLearning({ directory, bank:target, globalBank, prompt });
  assert.match(await recall('修改验收格式'), /清单/);
  assert.doesNotMatch(await recall('修改验收格式'), /表格/);
  assert.equal(await recall('修改验收格式', other), '');
  assert.match(await recall('需要简体中文', other), /全局.*简体中文/);
  assert.equal(await recall('明天天气如何'), '');
  const handler = createLearningHandler({}, directory);
  const url = 'http://fixture/api/hindsight-workbench/learning?scope=project&bank=' + encodeURIComponent(bank);
  const archive = action => handler(new Request(url, {
    method:'POST', headers:{ 'content-type':'application/json', 'x-hindsight-workbench':'1' },
    body:JSON.stringify({ id:entries[0].id, action }),
  }));
  assert.equal((await archive('archive')).status, 200);
  assert.equal(await recall('修改验收格式'), '');
  assert.equal((await archive('restore')).status, 200);
  assert.match(await recall('修改验收格式'), /清单/);
  assert.equal((await handler(new Request(url.replace('coding-agent', 'foreign')))).status, 400);
});

test('reflection uses paired host results and only repeated verified workflows become draft candidates', async t => {
  const directory = await workspace(t);
  const ok = [...operation('edit', 'apply_patch'), ...operation('test', 'pwsh', 'npm test', 0)];
  const failed = [...operation('inspect', 'pwsh', 'git status', 0), ...operation('edit', 'apply_patch'), ...operation('test', 'pwsh', 'npm test', 1, '1 failed')];
  assert.equal(reviewActions(ok).verified, true);
  assert.equal(reviewActions(failed).verified, false);
  assert.equal(reviewActions(failed).failed, 1);
  assert.equal(reviewActions([...operation('edit', 'apply_patch'), ...operation('test', 'pwsh', 'npm test', undefined, 'agent says it worked')]), null);
  const record = (session, events) => recordLearning({ directory, bank, globalBank, session, events:[user('执行安装验收'), ...events] });
  await Promise.all([record('s1', ok), record('s1', ok), record('s2', ok), record('fail', failed)]);
  let state = await getLearning(bank, directory);
  assert.equal(state.reviews.length, 3);
  assert.deepEqual(state.entries.map(row => [row.kind, row.status, row.sources.length]), [['workflow', 'candidate', 2]]);
  await record('s3', ok);
  state = await getLearning(bank, directory);
  assert.equal(state.entries[0].status, 'ready');
  assert.deepEqual(state.entries[0].steps, ['edit','test']);
  assert.equal(await recallLearning({ directory, bank, globalBank, prompt:'实施修改和运行测试' }), '');
});

test('recall obeys the frame budget and gives a same-topic project rule priority', async t => {
  const directory = await workspace(t);
  const remember = (session, text) => recordLearning({ directory, bank, globalBank, session, events:[user(text)] });
  await remember('g', '全局统一验收格式：全局表格');
  await remember('p', '这个项目统一验收格式：项目清单');
  for (let i = 0; i < 9; i++) {
    await remember('long-' + i, '以后验收报告栏目' + i + '：' + '验收报告必须清楚'.repeat(23));
  }
  const rules = await recallLearning({ directory, bank, globalBank, prompt:'请检查验收格式和验收报告' });
  assert.match(rules, /项目清单/);
  assert.doesNotMatch(rules, /全局表格/);
  assert.ok(rules.length <= 1000);
  assert.ok(rules.split('\n').length <= 5);
});
