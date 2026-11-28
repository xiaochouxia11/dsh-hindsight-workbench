// Source-only preflight. Reports known packaging blockers; does not publish.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const expected = new Set([
  'LICENSE', 'HINDSIGHT-LICENSE', 'README.md', 'cordis.patch.yml', 'dist/build.json', 'dist/client.js', 'dist/collector.js', 'dist/index.js', 'dist/learning.js',
  'docs/ACCEPTANCE.zh-CN.md', 'docs/INSTALL.zh-CN.md', 'icon.svg', 'locale/en.json',
  'locale/zh.json', 'package.json',
]);
if (!process.env.npm_execpath) throw new Error('Use npm run check:public-pack from the bundle root.');
const result = execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run', '--json', '--ignore-scripts', '--offline'], {encoding:'utf8',timeout:30_000});
const [pack] = JSON.parse(result);
const files = new Set(pack.files.map(({path}) => path));
const issues = [];
if ([...files].some(file => !expected.has(file))) issues.push('归档含有未审核的文件。');
if ([...expected].some(file => !files.has(file))) issues.push('归档缺少必需文件。');
const manifest = JSON.parse(await readFile('package.json','utf8'));
if (manifest.private === true || manifest.name.startsWith('@dsh-local/')) issues.push('仍使用本地私有包标识；不得作为公开市场包发布。');
// Intentionally report paths only; never print a matched value or file contents.
for (const file of expected) {
  if (!files.has(file)) continue;
  const text = await readFile(file,'utf8');
  if (/coding-agent::DeepSeek Harness-02|DeepSeek-Harness-Data|[A-Z]:[\\/]Users[\\/]/i.test(text)) {
    issues.push(`发现已知的本机配置标记：${file}`);
  }
}
if (issues.length) {
  process.stderr.write('公开包预检未通过：\n' + issues.map(issue=>' - '+issue).join('\n') + '\n');
  process.exitCode = 1;
} else {
  console.log('已通过包内容预检；仍需人工检查数据边界、实机验收和发布授权。');
}
