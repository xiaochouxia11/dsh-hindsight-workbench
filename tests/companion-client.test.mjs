import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { mountClient, text, walk } from './harness.mjs';

const control = (tree, type, label) => {
  const node = walk(tree).find(item => item.type === type && item.children.includes(label));
  assert.ok(node, 'missing control: ' + label);
  return node;
};
const fill = (render, label, value) =>
  control(render(), 'label', label).children[1].props.onChange({ target: { value } });
const submit = (render, button) => {
  const tree = render();
  const target = control(tree, 'button', button);
  const form = walk(tree).find(item => item.type === 'form' && walk(item).includes(target));
  assert.ok(form, 'missing form: ' + button);
  return form.props.onSubmit({ preventDefault() {} });
};
const mountCompanion = (tab, type, fetch) => {
  const page = mountClient({ tab }, { fetch });
  const component = walk(page.render()).find(item => item.type?.name === type);
  assert.ok(component, 'missing component: ' + type);
  return page.mountChild(component);
};

test('add Knowledge Base, import Markdown, search the selected base and read its source', async () => {
  const calls = [];
  let base;
  const { rerender, effects } = mountCompanion('knowledge', 'KnowledgeWorkspace', async (path, options) => {
    const body = options.body && JSON.parse(options.body);
    calls.push([path, options.method, body]);
    const route = '/api/hindsight-workbench/knowledge';
    if (path === route + '?op=list') return Response.json({ data: base ? [base] : [] });
    if (path === route + '?op=create') {
      base = {id:'hbm-kb-demo', name:body.name};
      assert.equal(options.headers['x-hindsight-workbench'], '1');
      return Response.json({data:base});
    }
    if (path === route + '?op=ingest') return Response.json({data:{id:body.documentId,status:'pending'}});
    if (path === route + '?op=search') return Response.json({data:[
      {id:'doc',index:1,title:'合成笔记',text:'检索标记'},
    ]});
    if (path === route + '?op=source&bank=hbm-kb-demo&id=doc') return Response.json({data:{text:'合成原文'}});
    assert.fail(path);
  });
  rerender();
  const stop = effects[0]();
  await setImmediate();
  fill(rerender, '新知识库名称', '合成测试库');
  submit(rerender, '创建知识库');
  await setImmediate();
  const creation = calls.find(([path, method]) => path.endsWith('?op=create') && method === 'POST');
  assert.deepEqual(creation[2], {name:'合成测试库'});
  fill(rerender, '文档标题', '合成笔记');
  fill(rerender, '文本或 Markdown', '# 检索标记');
  submit(rerender, '导入并索引');
  await setImmediate();
  assert.match(text(rerender()), /文档已提交/);
  fill(rerender, '搜索内容', '检索标记');
  submit(rerender, '搜索');
  await setImmediate();
  assert.equal(calls.find(([p]) => p.endsWith('?op=search'))[2].bank, 'hbm-kb-demo');
  assert.match(text(rerender()), /合成笔记/);
  control(rerender(), 'button', '查看原文').props.onClick();
  await setImmediate();
  assert.match(text(rerender()), /合成原文/);
  stop();
});

test('create a Skill using the installed manager contract and preserve a rejected duplicate draft', async () => {
  const calls = [];
  const { rerender } = mountCompanion('skills', 'SkillCreator', async (path, options) => {
    calls.push([path, options]);
    if (path.endsWith('/sidebar-entry')) return Response.json({ok:true,data:{}});
    if (calls.length === 2) return Response.json({ok:false,error:'同名技能已存在'}, {status:400});
    return Response.json({ok:true,data:{name:'sample-skill'}});
  });
  await control(rerender(), 'button', '添加 Skill').props.onClick();
  fill(rerender, '技能 ID（小写字母、数字和连字符）', 'sample-skill');
  fill(rerender, '简介', '合成测试技能');
  fill(rerender, '技能正文（Markdown）', '# 验证正文');
  await submit(rerender, '保存到 Harness Skills');
  assert.match(text(rerender()), /同名技能已存在/);
  assert.equal(control(rerender(), 'label', '技能正文（Markdown）').children[1].props.value, '# 验证正文');
  fill(rerender, '技能 ID（小写字母、数字和连字符）', 'unique-skill');
  await submit(rerender, '保存到 Harness Skills');
  assert.match(text(rerender()), /Skill 已添加/);
  assert.deepEqual(JSON.parse(calls[2][1].body), {root:'dsh',name:'unique-skill',description:'合成测试技能',body:'# 验证正文'});
  assert.equal(calls[2][1].headers['x-dsh-skills-manager'], '1');
});

test('an existing memory opens an unsaved Skill draft containing only the selected evidence', () => {
  const page = mountClient({
    selected: { id:'observation-one', scope:'global', kind:'memory' },
    detail: { value:{ id:'observation-one', fact_type:'observation', text:'已验证的工程经验' } },
  });
  const action = control(page.render(), 'button', '提炼为 Skill 草稿');
  action.props.onClick();
  assert.equal(page.values[1], 'evolution');
  const creator = walk(page.render()).find(node => node.type?.name === 'EvolutionWorkspace');
  assert.ok(creator);
  assert.equal(creator.props.evidence.id,'observation-one');
  assert.equal(creator.props.evidence.scopeLabel,'全局库');
  assert.equal(creator.props.evidence.text,'已验证的工程经验');
  creator.props.onDiscard();
  assert.equal(page.values.at(-1), null);
});
