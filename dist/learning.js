import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const digest = value => createHash('sha256').update(value).digest('hex');
const journal = () => path.join(process.env.DSH_HOME || path.join(homedir(), '.dsh'), 'storages', 'dsh-hindsight-workbench', 'learning');
const fileFor = (directory, bank) => path.join(directory, digest(bank) + '.json');
const pendingWrites = new Map();
const normalized = text => text.normalize('NFKC').toLowerCase().replace(/[\s，。！？、,.!?]+/gu, '');
const threshold = 3;
let configuredGlobalBank = 'coding-agent::global';
export function setLearningGlobalBank(bank) { configuredGlobalBank = bank; }

const excluded = /(?:这次|本次|今天|临时|这份|本份|就这|当前(?:任务|步骤|操作)|这(?:一个|一)?轮|一次性|只(?:用于|改|修改|在|针对)|仅(?:用于|本次|在|限|修改)|(?:这个|该|当前|这一)文件|这个例子|举个例子|^请问|假设|假如|如果|会怎样|怎么办|不要(?:记忆|记录|保存|记住)|别(?:记住|记录)|敏感信息|验证码|密码|凭据|私钥|令牌|密钥|api[_ -]?key|access[_ -]?token|password|bearer\s|sk-[a-z0-9-]{12,}|gh[pousr]_[a-z0-9]{10,}|\b(?:just this once|for this (?:file|example|run)|hypothetical|what if|suppose|do not remember|don't remember)\b|[\w-]+\.(?:[cm]?[jt]sx?|py|md|json|ya?ml|txt|sql|css)\b)/iu;
const projectScope = /^(?:在)?(?:这个|本|当前)(?:项目|仓库|工作区)(?:里|中)?/u;
const globalScope = /^(?:全局|所有项目(?:里|中)?|任何项目(?:里|中)?|我一贯|我一直)/u;
const correction = /^(?:我说过|不对[，,：:]?\s*(?:应该(?:是)?|要)?|应该是这样[，,：:]?|别再这样[，,：:]?|你怎么老是|我更想要|纠正一下)[，,：: ]*/u;
const preference = /^(?:请(?:你)?记住|记住|我(?:更)?喜欢(?:你)?|我的(?:风格|偏好)是|(?:请)?(?:从今往后|以后|今后|始终|统一)(?:默认|都)?|千万别|不要再)[：:，, ]*/u;
const repeatedInstruction = /^(?:请|务必|必须|先|每次|总是|优先|避免|不要)(?:\s|[\u4e00-\u9fff])/u;

export function classifyInstruction(input) {
  const original = typeof input === 'string' ? input.trim() : '';
  if (original.length < 4 || original.length > 280 || /[\n`<>\u0000-\u001f]|^\s*[“"'‘>•-]|[？?]|[。！!；;].+/.test(original) || excluded.test(original)) return null;
  const change = original.match(correction);
  const wording = original.replace(correction, '');
  const opening = wording.match(preference);
  const scopedText = wording.slice(opening?.[0].length || 0);
  const scoped = scopedText.match(globalScope) || scopedText.match(projectScope);
  const scope = scoped && globalScope.test(scoped[0]) ? 'global' : 'project';
  const afterScope = scopedText.slice(scoped?.[0].length || 0).replace(/^[：:，, ]+/u, '');
  const durable = afterScope.match(preference);
  const scopedRule = scoped && /^(?:都|用|采用|统一|保持|禁止|不要|别|必须|务必|默认|以后|喜欢|偏好)/u.test(afterScope);
  const explicit = opening || durable || scopedRule;
  if (!explicit && (change || !repeatedInstruction.test(afterScope))) return null;
  const rule = afterScope.slice(durable?.[0].length || 0);
  if (normalized(rule).length < 3 || /^(?:(?:就|也)?(?:这样|那样)(?:做|处理)?|照(?:这个|那个)做)[。！!]*$/u.test(rule)) return null;
  const named = rule.match(/^(?:(?:统一|默认|以后|都|请)?(?:设置|记住|使用)?[：:，, ]*)?([\p{L}\p{N} ]{2,28})[：:]\s*(.{2,})$/u);
  return {
    kind: change ? 'correction' : explicit ? 'preference' : 'instruction',
    scope, text: original, key: normalized(named ? named[1] : change ? wording : original),
  };
}

const commandKinds = [
  [/^(?:npm|pnpm|yarn)(?: run)? (?:test(?::[\w-]+)?)(?:\s|$)|^(?:python -m )?pytest(?:\s|$)|^(?:cargo|go|dotnet) test(?:\s|$)/i, 'test'],
  [/^(?:npm|pnpm|yarn)(?: run)? build(?:\s|$)|^(?:cargo|go|dotnet) build(?:\s|$)/i, 'build'],
  [/^(?:npm|pnpm|yarn)(?: run)? (?:lint|typecheck)(?:\s|$)/i, 'check'],
  [/^(?:git (?:diff|status|log|show)|rg|Get-Content)(?:\s|$)/i, 'inspect'],
];
const fileTools = { read_file: 'inspect', apply_patch: 'edit', edit_file: 'edit', write_file: 'edit' };
export const stepNames = { inspect: '检查现有状态', edit: '实施修改', build: '构建', test: '运行测试', check: '运行静态检查' };

function actionKind(call) {
  if (Object.hasOwn(fileTools, call.name)) return fileTools[call.name];
  if (call.name !== 'bash' && call.name !== 'pwsh') return null;
  let command;
  try { command = JSON.parse(call.arguments).command; } catch { return null; }
  if (typeof command !== 'string' || /[\n;&|<>`]/.test(command)) return null;
  return commandKinds.find(([pattern]) => pattern.test(command.trim()))?.[1];
}

export function reviewActions(events) {
  const calls = new Map();
  const steps = [];
  let failed = 0;
  for (const { type, data } of events) {
    if (type === 'tool/call' && data?.callId) {
      const kind = actionKind(data);
      if (kind) calls.set(data.callId, kind);
    }
    if (type !== 'tool/result') continue;
    const result = data?.message;
    const id = result?.toolCallId ?? result?.source?.callId;
    const kind = calls.get(id);
    if (!kind) continue;
    calls.delete(id);
    const output = (result.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n');
    const exit = data.meta?.exitCode ?? data.meta?.exit_code;
    if (data.error || result.isError || (typeof exit === 'number' && exit !== 0) ||
      /(?:exit code[: ]+[1-9]\d*|\b[1-9]\d* (?:failed|failing)\b|(?:^|\n)(?:FAIL |not ok )|(?:^|\n)[#ℹ]\s*fail\s+[1-9])/im.test(output)) {
      failed++;
      continue;
    }
    const verification = kind === 'test' || kind === 'check';
    const confirmed = exit === 0 || /(?:exit code[: ]+0\b|\b[1-9]\d* (?:passed|passing)\b|(?:^|\n)[#ℹ]\s*pass\s+[1-9]|(?:^|\n)ok\s+\S)/im.test(output);
    if (!verification || confirmed) {
      if (steps.at(-1) !== kind) steps.push(kind);
    }
  }
  if (new Set(steps).size < 2) return null;
  const verified = ['test', 'check'].includes(steps.at(-1)) && failed === 0;
  return { steps: steps.slice(-8), failed, verified };
}

async function readState(directory, bank) {
  try {
    const state = JSON.parse(await readFile(fileFor(directory, bank), 'utf8'));
    if (state.bank !== bank || !Array.isArray(state.entries) || !Array.isArray(state.reviews) || !Array.isArray(state.processed)) {
      throw new Error('Invalid learning journal');
    }
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return { bank, entries: [], reviews: [], processed: [] };
    throw error;
  }
}

function updateState(directory, bank, change) {
  const file = fileFor(directory, bank);
  const operation = (pendingWrites.get(file) || Promise.resolve()).then(async () => {
    const state = await readState(directory, bank);
    if (!(await change(state))) return state;
    await mkdir(directory, { recursive: true });
    const temporary = file + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch(() => {});
    }
    return state;
  });
  const settled = operation.catch(() => {});
  pendingWrites.set(file, settled);
  void settled.then(() => { if (pendingWrites.get(file) === settled) pendingWrites.delete(file); });
  return operation;
}

function recordEntry(state, item, source) {
  const id = digest(item.key).slice(0, 24);
  const existing = state.entries.find(row => row.id === id);
  if (existing?.archived) return;
  const evidence = existing?.sources || [];
  const sources = evidence.some(row => row.session === source.session) ? evidence : [...evidence, source].slice(-12);
  const kind = item.kind === 'correction' || existing?.kind !== 'correction' ? item.kind : existing.kind;
  let status = kind !== 'instruction' || sources.length >= threshold ? 'durable' : 'candidate';
  if (kind === 'workflow') status = existing?.status === 'adopted' ? 'adopted' : (sources.length >= threshold ? 'ready' : 'candidate');
  const entry = { id, kind, status, sources, text: item.text, steps: item.steps };
  if (existing?.previous) entry.previous = existing.previous;
  if (existing && item.kind === 'correction' && existing.text !== item.text) entry.previous = existing.text;
  state.entries = [entry, ...state.entries.filter(row => row.id !== id)];
  if (state.entries.length > 200) {
    const oldestCandidate = state.entries.findLastIndex(row => row.status === 'candidate' && !row.archived);
    state.entries.splice(oldestCandidate < 0 ? 0 : oldestCandidate, 1);
  }
}

export async function recordLearning({ session, events, bank, globalBank = configuredGlobalBank, directory = journal() }) {
  if (!session || !Array.isArray(events)) return;
  let index = events.length - 1;
  while (index >= 0 && !(events[index]?.type === 'user/message' && events[index].data?.source?.kind === 'user')) index--;
  if (index < 0) return;
  const event = events[index];
  const user = (event.data.content || []).filter(block => block?.type === 'text').map(block => block.text).join('\n');
  const instruction = classifyInstruction(user);
  const review = reviewActions(events.slice(index + 1).filter(Boolean));
  const id = digest(JSON.stringify([session, event.data.id ?? event.seq ?? index])).slice(0, 24);
  const source = { id, session: digest(session).slice(0, 16), date: new Date().toISOString() };
  const scopeBank = instruction?.scope === 'global' ? globalBank : bank;
  async function record(target, observe, reflect) {
    return updateState(directory, target, state => {
      if (state.processed.includes(id)) return false;
      state.processed = [id, ...state.processed].slice(0, 500);
      if (observe) recordEntry(state, observe, source);
      if (reflect) {
        state.reviews = [{ ...reflect, id, date: source.date }, ...state.reviews].slice(0, 50);
        if (reflect.verified && reflect.failed === 0) {
          const key = 'workflow:' + reflect.steps.join(',');
          recordEntry(state, { kind: 'workflow', key, text: reflect.steps.map(step => stepNames[step]).join(' → '), steps: reflect.steps }, source);
        }
      }
      return true;
    });
  }
  if (instruction && scopeBank !== bank) await record(scopeBank, instruction, null);
  if (review || (instruction && scopeBank === bank)) await record(bank, instruction && scopeBank === bank ? instruction : null, review);
}

export async function listLearningBanks(directory = journal()) {
  const files = await readdir(directory).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const banks = await Promise.all(files.filter(file => /^[a-f0-9]{64}\.json$/.test(file)).map(async file => {
    try {
      const { bank } = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
      if (typeof bank === 'string' && file === digest(bank) + '.json') return bank;
    } catch { /* A damaged file remains available for repair. */ }
  }));
  return banks.filter(Boolean);
}

export async function getLearning(bank, directory = journal()) {
  const { entries, reviews } = await readState(directory, bank);
  return { entries, reviews };
}

export async function updateLearning(bank, id, action, directory = journal()) {
  let updated = false;
  await updateState(directory, bank, state => {
    const item = state.entries.find(row => row.id === id);
    if (!item) return false;
    if (action === 'adopt') {
      if (item.archived || !['ready', 'adopted'].includes(item.status)) return false;
      item.status = 'adopted';
    } else item.archived = action === 'archive';
    updated = true;
    return true;
  });
  return updated;
}

function tokens(text) {
  const words = text.normalize('NFKC').toLowerCase().match(/[a-z][a-z0-9-]{1,}|[\p{Script=Han}]+/gu) || [];
  return new Set(words.flatMap(word => /^[a-z]/.test(word) ? [word]
    : Array.from({ length: Math.max(0, word.length - 1) }, (_, index) => word.slice(index, index + 2))));
}

const filler = /^(?:以后|今后|统一|默认|请记住|这个项目|所有项目|我一贯|我一直|我喜欢|不对|我说过|应该|不要|千万别)/u;
export async function recallLearning({ bank, globalBank = configuredGlobalBank, prompt, directory = journal() }) {
  const terms = tokens(prompt || '');
  if (!terms.size) return '';
  const banks = [...new Set([bank, globalBank])];
  const states = await Promise.all(banks.map(value => getLearning(value, directory).catch(() => ({ entries: [] }))));
  const activeProject = new Set(states[0].entries.filter(entry => entry.status === 'durable' && !entry.archived).map(entry => entry.id));
  const rows = states.flatMap(({ entries }, index) => entries.filter(entry => entry.status === 'durable' && !entry.archived
    && (index === 0 || !activeProject.has(entry.id)))
    .map(entry => {
      const keys = [...tokens(entry.text.replace(filler, ''))];
        const score = keys.filter(key => terms.has(key)).length;
      return { entry, score, label: banks[index] === globalBank ? '全局' : '项目' };
    }));
  const ranked = rows.filter(row => row.score >= 2 || (row.score === 1 && /[a-z]{4,}/i.test(row.entry.text)))
    .sort((a, b) => b.score - a.score);
  const result = [];
  let remaining = 1000;
  for (const { entry, label } of ranked) {
    const line = '- [' + label + '] ' + entry.text;
    if (line.length + 1 > remaining) continue;
    result.push(line);
    remaining -= line.length + 1;
    if (result.length === 5) break;
  }
  return result.join('\n');
}
