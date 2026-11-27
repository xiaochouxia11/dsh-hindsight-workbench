import { request as httpRequest } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const name = 'dsh-hindsight-workbench';
export const inject = ['connection'];
export const ROUTE = '/api/hindsight-workbench';
export const BANK = 'coding-agent::default';
export const GLOBAL_BANK = 'coding-agent::global';
export const BANKS_PATH = '/v1/default/banks';
export const KBS_PATH = '/v1/default/knowledge-banks';

export const rootFor = bank => '/v1/default/banks/' + encodeURIComponent(bank);

export function validBank(value) {
  return typeof value === 'string'
    && value.length > 0 && value.length <= 200
    && value === value.trim()
    && !['.', '..'].includes(value)
    && !/[\u0000-\u001f\u007f\/\\?#]/.test(value);
}

export function bankAllowed(bound, candidate) {
  if (!validBank(candidate)) return false;
  if (candidate === bound) return true;
  const separator = bound.indexOf('::');
  return separator > 0 && candidate.startsWith(bound.slice(0, separator + 2));
}

export function connectionOptions(config = {}) {
  const url = new URL(config.endpoint || 'http://127.0.0.1:9077');
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('仅支持无凭证的本机回环 HTTP 服务地址');
  const bank = config.bank || BANK;
  if (!validBank(bank)) throw new Error('无效的记忆库名称');
  const globalBank = config.globalBank || GLOBAL_BANK;
  if (!validBank(globalBank) || globalBank === bank) throw new Error('全局库必须有效且与项目库隔离');
  return { endpoint: url.origin, bank, globalBank, hostname: url.hostname.replace(/^\[|\]$/g,''), port: url.port || '80' };
}

// Intentionally fixed loopback target and explicit GET allowlist: not an arbitrary proxy.
export function targetFor(params, bank = BANK) {
  const op = params.get('op') || 'status';
  const id = params.get('id');
  const root = rootFor(bank);
  const query = new URLSearchParams();
  switch (op) {
    case 'status': return '/health';
    case 'banks': {
      query.set('limit', '100');
      return BANKS_PATH + '?' + query;
    }
    case 'stats': return root + '/stats';
    case 'pages': return root + '/pages/tree';
    case 'page':
    case 'memory':
    case 'observation-history':
    case 'document-history':
      if (!id || ['.','..'].includes(id) || id.length > 256 || /[\x00-\x1f]/.test(id)) throw new Error('无效的记录 ID');
      if (op === 'document-history') return root + '/documents/' + encodeURIComponent(id) + '/history?limit=20';
      if (op === 'observation-history') return root + '/memories/' + encodeURIComponent(id) + '/history';
      return root + (op === 'page' ? '/pages/' : '/memories/') + encodeURIComponent(id);
    case 'list': {
      const offset = Number(params.get('offset') || 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new Error('无效的分页位置');
      query.set('limit', '30'); query.set('offset', String(offset));
      const q = params.get('q') || '';
      if (q.length > 500) throw new Error('关键词不能超过 500 字');
      if (q) query.set('q', q);
      return root + '/memories/list?' + query;
    }
    case 'graph': return root + '/graph?limit=1000';
    case 'kbs': {
      query.set('limit', '100');
      return KBS_PATH + '?' + query;
    }
    case 'kbdocs': {
      if (!validBank(id)) throw new Error('无效的知识库 ID');
      query.set('limit', '50');
      return KBS_PATH + '/' + encodeURIComponent(id) + '/documents?' + query;
    }
    default: throw new Error('不支持的只读操作');
  }
}

export function readLocal(pathname, signal, options = connectionOptions(), request = {}) {
  return new Promise((resolve, reject) => {
    const payload = request.body === undefined ? undefined : JSON.stringify(request.body);
    const headers = { Accept: request.asText ? 'text/plain' : 'application/json' };
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = httpRequest({ hostname: options.hostname, port: options.port, path: pathname, method: request.method || 'GET', headers, signal }, res => {
      const chunks = []; let length = 0;
      res.on('data', chunk => {
        length += chunk.length;
        if (length > 16 * 1024 * 1024) { res.destroy(); reject(new Error('响应超过 16 MB，请缩小查询')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        // Never trust a charset inferred by PowerShell or the browser. No mojibake repair.
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
        catch { reject(Object.assign(new Error('响应不是有效 UTF-8：这是响应解码问题，不能据此判定存储损坏'), { code: 'UTF8_DECODE' })); return; }
        if ((res.statusCode || 500) >= 300) { reject(Object.assign(new Error(`Hindsight 返回 HTTP ${res.statusCode}`), { status: res.statusCode })); return; }
        if (request.asText) { resolve(text); return; }
        try { resolve(JSON.parse(text)); }
        catch { reject(new Error('后端未返回有效 JSON，未对原文做转码或修复')); }
      });
    });
    req.setTimeout(request.timeoutMs ?? 12000, () => req.destroy(new Error('连接超时，请确认本机 Hindsight 服务正在运行')));
    req.on('error', reject); req.end(payload);
  });
}

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const healthStatus = value => ['healthy','unhealthy','degraded'].includes(value) ? value : 'unknown';
const documentHistoryKinds = new Set([
  'retain', 'append', 'reprocess', 'retag', 'fact_edited', 'fact_invalidated',
  'fact_restored', 'fact_deleted', 'observations_cleared', 'consolidation',
]);
const historyDate = value => typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value)) ? value : null;
const historyCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

function historyData(raw, operation) {
  if (operation === 'document-history' && Array.isArray(raw?.items)) {
    return { items: raw.items.slice(0, 30).filter(item => item && typeof item === 'object').map(item => ({
      kind: documentHistoryKinds.has(item.kind) ? item.kind : 'unknown',
      date: historyDate(item.created_at),
      factsAdded: historyCount(item.facts_added),
      factsRemoved: historyCount(item.facts_removed),
      observationsChanged: historyCount(item.observations_created?.count) +
        historyCount(item.observations_updated?.count) + historyCount(item.observations_removed?.count),
    })) };
  }
  if (operation === 'observation-history' && Array.isArray(raw)) {
    return { items: raw.slice(0, 20).filter(item => item && typeof item === 'object').map(item => ({
      date: historyDate(item.changed_at),
      previousText: typeof item.previous_text === 'string' ? item.previous_text.slice(0, 4000) : '',
      newSources: Array.isArray(item.new_source_memory_ids) ? item.new_source_memory_ids.length : 0,
    })) };
  }
  throw new Error('历史响应结构不受支持');
}
function failure(error) {
  const status = error.status === 404 ? 404 : error.status === 401 || error.status === 403 ? 502 : 503;
  return { status, error: error.code === 'UTF8_DECODE' ? '响应不是有效 UTF-8：这是响应解码问题，不能据此判定存储损坏' : error.status === 404 ? '记忆库未创建或此接口不可用；本工作台不会自动创建或修复。' : error.status ? `Hindsight 返回 HTTP ${error.status}；未读取到内容。` : '无法连接本机 Hindsight，或响应读取失败。请确认本机服务可用后重试。', code: error.code === 'UTF8_DECODE' ? error.code : 'BACKEND_UNAVAILABLE' };
}

export function parseFrontmatter(text) {
  const head = String(text || '').slice(0, 8192);
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head);
  const body = match ? match[1] : head;
  const pick = key => {
    const line = new RegExp('^' + key + ':\\s*(.+)$', 'm').exec(body);
    return line ? line[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return { name: pick('name'), description: pick('description') };
}

export async function readSkills(config = {}, env = process.env) {
  const home = env.DSH_HOME || path.join(homedir(), '.dsh');
  const roots = [path.join(home, 'skills')];
  if (Array.isArray(config.skillDirs)) for (const dir of config.skillDirs) if (typeof dir === 'string' && dir.trim()) roots.push(dir);
  const items = [];
  for (const root of roots) {
    let entries = [];
    try { entries = await readdir(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const text = await readFile(path.join(root, entry.name, 'SKILL.md'), 'utf8');
        const meta = parseFrontmatter(text);
        items.push({ id: entry.name, name: meta.name || entry.name, description: meta.description || '' });
      } catch { /* not a skill directory */ }
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  return { items, total: items.length };
}

// Project is explicitly bound configuration, not a guessed current-session directory.
export function createHandler(read = readLocal, config = {}, inventory, skills = () => readSkills(config)) {
  const options = connectionOptions(config);
  return async request => {
    if (request.method !== 'GET') return json({ error: '仅允许只读 GET' }, 405);
    const params = new URL(request.url).searchParams;
    const op = params.get('op') || 'status';
    const scope = params.get('scope') || 'project';
    if (!['project','global','both'].includes(scope) || (scope === 'both' && !['list','diagnostics'].includes(op))) return json({error:'此操作必须指定一个有效来源库'},400);
    const requestedBank = params.get('bank');
    if (requestedBank !== null && requestedBank !== '' && !validBank(requestedBank)) return json({ error: '无效的记忆库名称' }, 400);
    const globalBank = options.globalBank;
    const projectAllowed = candidate => candidate !== globalBank && bankAllowed(options.bank, candidate);
    const bank = projectAllowed(requestedBank) ? requestedBank : options.bank;
    const bankFor = s => s === 'global' ? globalBank : bank;
    const sourceFor = s => ({scope:s,bank:bankFor(s),label:s==='global'?'全局库':'当前项目库'});
    const readScope = async s => {
      const template = targetFor(params, bank);
      const target = template.startsWith('/v1/default/banks/') ? rootFor(bankFor(s)) + template.slice(rootFor(bank).length) : template;
      return read(target, request.signal, options);
    };
    try {
      if (op === 'skills') return json({ data: await skills(), encoding: 'utf-8-strict' });
      if (op === 'banks') {
        const raw = await read(targetFor(params, bank), request.signal, options);
        const banks = (Array.isArray(raw?.banks) ? raw.banks : []).map(b => ({
          id: typeof b?.bank_id === 'string' ? b.bank_id : '',
          name: typeof b?.name === 'string' ? b.name : '',
          facts: Number.isFinite(b?.fact_count) ? b.fact_count : null,
          updatedAt: typeof b?.updated_at === 'string' ? b.updated_at : null,
        })).filter(b => projectAllowed(b.id));
        return json({ data: { banks, total: banks.length, projectBank: options.bank, globalBank }, encoding: 'utf-8-strict', endpoint: options.endpoint, bank });
      }
      if (op === 'diagnostics') {
        const check = async (pathname) => {try{const raw=await read(pathname,request.signal,options);const data=pathname==='/health'?{status:healthStatus(raw?.status)}:Object.fromEntries(['total_nodes','total_links','total_documents','pending_operations','failed_operations'].map(k=>[k,typeof raw?.[k]==='number'&&Number.isFinite(raw[k])?raw[k]:null]));return {ok:true,data};}catch(e){return {ok:false,...failure(e)};}};
        const [health,project,global,upstream] = await Promise.all([
          check('/health'), check(rootFor(bank)+'/stats'), check(rootFor(globalBank)+'/stats'),
          inventory ? inventory().catch(()=>({available:false,error:'无法读取官方插件清单，未执行任何安装或启用操作。'})) : {available:false,error:'官方插件管理服务不可用，未检查上游挂载。'}
        ]);
        // Health is only connectivity evidence; never pass arbitrary backend configuration to Client.
        return json({data:{endpoint:options.endpoint,project:sourceFor('project'),global:sourceFor('global'),health:health.ok?{ok:true,status:health.data?.status||'unknown'}:health,
          banks:[{source:sourceFor('project'),...project},{source:sourceFor('global'),...global}],upstream,
          projectBinding:'configured',automaticDualInjection:false,writeEnabled:false,encoding:'utf-8-strict'},encoding:'utf-8-strict'});
      }
      if (scope === 'both') {
        // Validate before dispatch; both bank windows use the same keyword and offset. No score fusion.
        targetFor(params, bank);
        const results = await Promise.all(['project','global'].map(async s=>{try{const data=await readScope(s);return {ok:true,source:sourceFor(s),data};}catch(e){return {ok:false,source:sourceFor(s),...failure(e)};}}));
        return json({data:{items:results.flatMap(r=>r.ok?(r.data.items||[]).map(item=>({...item,_source:r.source})):[]),sources:results.map(r=>r.ok?{ok:true,source:r.source,total:r.data.total}:r),partial:results.some(r=>!r.ok),limit:30,offset:Number(params.get('offset')||0)},encoding:'utf-8-strict',endpoint:options.endpoint});
      }
      // No raw bank/path/endpoint from the browser is ever used to select a target.
      const raw = await readScope(scope);
      if (op === 'document-history' || op === 'observation-history') {
        return json({ data: historyData(raw, op), source: sourceFor(scope) });
      }
      const data = op === 'status' ? {status:healthStatus(raw?.status)} : op === 'list' ? {...raw,items:(raw.items||[]).map(item=>({...item,_source:sourceFor(scope)}))} : raw;
      return json({ data, source:sourceFor(scope), encoding:'utf-8-strict',endpoint:options.endpoint,bank:bankFor(scope) });
    } catch (error) {
      if (error.message?.startsWith('无效') || error.message?.startsWith('不支持') || error.message?.startsWith('关键词')) return json({error:error.message},400);
      const f=failure(error); return json(f,f.status);
    }
  };
}

export async function upstreamInventory(manager) {
  if (!manager) return {available:false,error:'官方插件管理服务不可用，未检查上游挂载。'};
  const pkg='@vectorize-io/hindsight-coding-agents';
  const [plugins,bundles]=await Promise.all([manager.listPlugins(),manager.listBundles()]);
  const entries=plugins.filter(p=>p.moduleName===pkg+'/dsh').map(p=>({enabled:p.enabled===true,phase:['pending','loading','active','failed','unloading'].includes(p.fiberPhase)?p.fiberPhase:null}));
  const bundle=bundles.find(b=>b.name===pkg);
  return {available:true,installed:bundle?.installed===true,version:/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(bundle?.version||'')?bundle.version:null,entries,duplicate:entries.length>1};
}

export const KNOWLEDGE_ROUTE = ROUTE + '/knowledge';
const KNOWLEDGE_ACTIONS = new Map([
  ['list', 'GET'], ['source', 'GET'], ['document', 'GET'], ['create', 'POST'], ['ingest', 'POST'], ['search', 'POST'],
]);
const KNOWLEDGE_PREFIX = 'hbm-kb-';
const KB_DOCUMENT = /^hbm-doc-[a-f0-9-]{36}$/;

function knowledgeBankId(value) {
  return validBank(value) && value.startsWith(KNOWLEDGE_PREFIX);
}

function knowledgePostAllowed(request) {
  if (request.headers.get('x-hindsight-workbench') !== '1') return false;
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  // DSH's web host authenticates the browser and forwards a synthetic request URL.
  if (fetchSite === 'same-origin') return true;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const url = new URL(request.url);
  return origin === url.origin || origin === 'dsh-app://app' || origin === url.protocol + '//' + url.host;
}

export function createKnowledgeHandler(transport = readLocal, config = {}) {
  const options = connectionOptions(config);
  return async request => {
    const params = new URL(request.url).searchParams;
    const action = params.get('op');
    if (!KNOWLEDGE_ACTIONS.has(action)) return json({ error: '不支持的知识库操作。' }, 400);
    if (request.method !== KNOWLEDGE_ACTIONS.get(action)) return json({ error: '请求方式不受支持。' }, 405);

    let input = {};
    if (request.method === 'POST') {
      if (!knowledgePostAllowed(request)) return json({ error: '知识库请求必须来自工作台。' }, 403);
      if (Number(request.headers.get('content-length')) > 750000) return json({ error: '知识库请求过长。' }, 413);
      try {
        const payload = await request.text();
        if (payload.length > 750000) return json({ error: '知识库请求过长。' }, 413);
        input = JSON.parse(payload);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError();
      } catch {
        return json({ error: '无效的知识库请求。' }, 400);
      }
    }

    const bank = request.method === 'GET' ? params.get('bank') : input.bank;
    const send = (pathname, requestOptions) => transport(pathname, request.signal, options, requestOptions);
    const post = (pathname, body) => send(pathname, { method: 'POST', body });
    const root = KBS_PATH + '/' + encodeURIComponent(knowledgeBankId(bank) ? bank : '');
    try {
      if (action === 'list') {
        const raw = await send(KBS_PATH + '?limit=100');
        if (!Array.isArray(raw?.banks)) throw new Error('Invalid knowledge catalog');
        return json({ data: raw.banks.filter(item => knowledgeBankId(item?.bank_id)).map(item => ({
          id: item.bank_id, name: item.bank_id.slice(KNOWLEDGE_PREFIX.length), documents: item.document_count,
        })) });
      }
      if (action === 'create') {
        const name = typeof input.name === 'string' ? input.name.trim().normalize('NFC') : '';
        const id = KNOWLEDGE_PREFIX + name;
        if (!name || name.length > 64 || !knowledgeBankId(id) || /[<>:"|*%]/.test(name)) return json({ error: '请输入有效的知识库名称（最多 64 字）。' }, 400);
        await post(KBS_PATH, { bank_id: id });
        return json({ data: { id, name } });
      }
      if (!knowledgeBankId(bank)) return json({ error: '请选择工作台的知识库。' }, 400);
      if (action === 'ingest') {
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        const content = input.content;
        if (!title || title.length > 160 || /[\u0000-\u001f\u007f/\\]/.test(title) ||
            typeof content !== 'string' || !content.trim() || content.length > 100000) {
          return json({ error: '请填写合法标题和非空正文（最多 100,000 字）。' }, 400);
        }
        if (typeof input.documentId !== 'string' || !KB_DOCUMENT.test(input.documentId)) return json({ error: '无效的文档 ID。' }, 400);
        const result = await post(root + '/ingest', {
          items: [{ document_id: input.documentId, filename: /\.(?:md|txt)$/i.test(title) ? title : title + '.md', text: content }],
          async: true,
        });
        if (!Array.isArray(result?.document_ids) || !result.document_ids.includes(input.documentId)) throw new Error('Missing document acknowledgement');
        return json({ data: { id: input.documentId, status: 'pending' } });
      }
      if (action === 'search') {
        const query = typeof input.query === 'string' ? input.query.trim() : '';
        if (!query || query.length > 500) return json({ error: '请输入关键词（最多 500 字）。' }, 400);
        const raw = await post(root + '/search', { query, budget: 'low', max_tokens: 2400, enable_reranking: false, media_types: ['text'] });
        if (!Array.isArray(raw?.results)) throw new Error('Invalid knowledge search response');
        return json({ data: raw.results.slice(0, 30).filter(hit => typeof hit?.document_id === 'string' && KB_DOCUMENT.test(hit.document_id)).map(hit => ({
          id: hit.document_id, index: hit.index, title: hit.filename, text: hit.text,
        })) });
      }
      const id = params.get('id');
      if (!id || !KB_DOCUMENT.test(id)) return json({ error: '无法读取该资料的原文。' }, 400);
      const documentPath = root + '/documents/' + encodeURIComponent(id);
      if (action === 'document') {
        const detail = await send(documentPath);
        const status = ['pending', 'processing', 'ready', 'failed'].includes(detail?.status) ? detail.status : 'unknown';
        return json({ data: { id, status, passages: detail?.passage_count } });
      }
      const source = await send(documentPath + '/file', { asText: true });
      return json({ data: { text: source.slice(0, 20000), truncated: source.length > 20000 } });
    } catch (error) {
      const status = [400, 404, 409, 422].includes(error.status) ? error.status : 503;
      const messages = {
        400: 'Hindsight 拒绝了知识库请求。',
        404: action === 'list' ? '当前 Hindsight 版本未提供知识库接口。' : '找不到指定的知识库或文档。',
        409: '该知识库名称已存在。',
        422: 'Hindsight 无法处理该知识库请求。',
        503: request.method === 'POST' && action !== 'search'
          ? '未取得写入确认。请刷新清单或用同一份草稿重试。' : '无法读取 Hindsight 知识库响应。',
      };
      return json({ error: messages[status] }, status);
    }
  };
}

export function apply(ctx, config = {}) {
  ctx.effect(() => ctx.connection.fetch.register({ path: ROUTE, methods: ['GET'], requestBody:'buffered', fetch:createHandler(readLocal,config,()=>upstreamInventory(ctx.get('pluginManager')),()=>readSkills(config)) }));
  ctx.effect(() => ctx.connection.fetch.register({ path: KNOWLEDGE_ROUTE, methods: ['GET', 'POST'], requestBody:'buffered', fetch:createKnowledgeHandler(readLocal, config) }));
  const home = process.env.DSH_HOME || path.join(homedir(), '.dsh');
  ctx.effect(() => ctx.connection.fetch.register({
    path: EVOLUTION_ROUTE, methods: ['GET', 'POST'], requestBody: 'buffered',
    fetch: createEvolutionHandler(path.join(home, 'storages', name, 'evolution-draft.json')),
  }));
  ctx.effect(() => ctx.connection.fetch.register({
    path: NOTES_ROUTE, methods: ['GET', 'POST'], requestBody: 'buffered',
    fetch: createNotesHandler(path.join(home, 'storages', name, 'notes'), config),
  }));
  ctx.effect(() => ctx.connection.fetch.register({
    path: RECALL_ROUTE, methods: ['POST'], requestBody: 'buffered',
    fetch: createRecallHandler(readLocal, config),
  }));
}

export const EVOLUTION_ROUTE = ROUTE + '/evolution';
export const NOTES_ROUTE = ROUTE + '/notes';
export const RECALL_ROUTE = ROUTE + '/recall';

export function createRecallHandler(transport = readLocal, config = {}) {
  const options = connectionOptions(config);
  return async request => {
    if (request.method !== 'POST') return json({ error: '仅支持从工作台提交召回。' }, 405);
    if (!knowledgePostAllowed(request)) return json({ error: '召回必须从工作台发起。' }, 403);
    let input;
    try {
      const body = await request.text();
      if (body.length > 4000) return json({ error: '召回请求过大。' }, 413);
      input = JSON.parse(body);
    } catch {
      return json({ error: '无法读取召回请求。' }, 400);
    }
    const { scope, bank } = input || {};
    const query = typeof input?.query === 'string' ? input.query.trim() : '';
    if (!query || query.length > 500 || !['project', 'global', 'both'].includes(scope)
      || (scope !== 'global' && (bank === options.globalBank || !bankAllowed(options.bank, bank)))) {
      return json({ error: '请输入不超过 500 字的查询，并选择有效的来源库。' }, 400);
    }
    const scopes = scope === 'both' ? ['project', 'global'] : [scope];
    const sources = await Promise.all(scopes.map(async sourceScope => {
      const global = sourceScope === 'global';
      const source = { scope: sourceScope, bank: global ? options.globalBank : bank, label: global ? '全局库' : '当前项目库' };
      const root = rootFor(source.bank);
      try {
        await transport(root + '/stats', request.signal, options);
        const result = await transport(root + '/memories/recall', AbortSignal.any([request.signal, AbortSignal.timeout(42000)]), options, { method: 'POST', timeoutMs: 40000, body: {
          query, budget: 'low', max_tokens: 1600, prefer_observations: true,
          rerank: { prune: false, dedup: false }, include: { entities: null, chunks: null, source_facts: null },
        } });
        if (!Array.isArray(result?.results)) throw new Error('Invalid recall response');
        const items = result.results.filter(row => typeof row?.id === 'string' && typeof row.text === 'string').slice(0, 30).map(row => ({
          id: row.id, text: row.text, fact_type: row.type,
          mentioned_at: row.mentioned_at, occurred_start: row.occurred_start, _source: source,
        }));
        return { ok: true, source, items, total: items.length };
      } catch (error) {
        return { ok: false, source, ...failure(error) };
      }
    }));
    if (scope !== 'both' && !sources[0].ok) return json(sources[0], sources[0].status);
    return json({
      data: {
        items: sources.flatMap(source => source.items || []),
        sources: sources.map(({ items, ...source }) => source),
        partial: sources.some(source => !source.ok),
        limit: 30, offset: 0,
      },
    });
  };
}

async function saveLocalRecord(file, record) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    await rename(temp, file);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}

function readLocalRecord(file, fallback) {
  return readFile(file, 'utf8').then(JSON.parse, error => {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  });
}

function cleanEvolutionDraft(draft) {
  const bounded = (value, size) => typeof value === 'string' && value.length <= size;
  const evidence = draft?.evidence;
  if (!bounded(evidence?.id, 256) || !evidence.id || !bounded(evidence?.scopeLabel, 64)
    || !bounded(evidence?.text, 12000) || !bounded(draft.name, 64)
    || !bounded(draft.description, 500) || !bounded(draft.body, 64000)
    || typeof draft.includeEvidence !== 'boolean') return null;
  return {
    evidence: { id: evidence.id, scopeLabel: evidence.scopeLabel, text: evidence.text },
    name: draft.name, description: draft.description, body: draft.body, includeEvidence: draft.includeEvidence,
  };
}

export function createEvolutionHandler(file) {
  let writes = Promise.resolve();
  async function load() {
    const item = await readLocalRecord(file, { revision: null, draft: null });
    if (item.draft !== null && (typeof item.revision !== 'string' || !cleanEvolutionDraft(item.draft))) {
      throw new Error('Invalid stored draft');
    }
    return item;
  }

  return async request => {
    try {
      if (request.method === 'GET') return json({ data: await load() });
      if (request.method !== 'POST') return json({ error: '不支持的草稿操作。' }, 405);
      if (!knowledgePostAllowed(request)) return json({ error: '草稿操作必须从工作台发起。' }, 403);
      let input;
      try {
        const body = await request.text();
        if (body.length > 465000) return json({ error: '草稿过大。' }, 413);
        input = JSON.parse(body);
      } catch {
        return json({ error: '无法读取草稿。' }, 400);
      }
      const draft = input?.draft === null ? null : cleanEvolutionDraft(input?.draft);
      if (!input || (input.draft !== null && !draft) ||
        (input.revision !== null && typeof input.revision !== 'string')) {
        return json({ error: '草稿内容无效或超过长度限制。' }, 400);
      }
      const pending = writes.then(async () => {
        const current = await load();
        if (current.revision !== input.revision) {
          return json({ error: '另一窗口已修改草稿。请重新打开进化页读取最新版本。' }, 409);
        }
        const next = { revision: randomUUID(), draft };
        await saveLocalRecord(file, next);
        return json({ data: next });
      });
      writes = pending.catch(() => {});
      return await pending;
    } catch {
      return json({ error: '无法读取或保存本机进化草稿。' }, 503);
    }
  };
}

const noteTypes = ['preference', 'project', 'experience'];

export function createNotesHandler(directory, config = {}) {
  const options = connectionOptions(config);
  let writes = Promise.resolve();
  return async request => {
    const params = new URL(request.url).searchParams;
    const scope = params.get('scope');
    const bank = scope === 'global' ? options.globalBank : params.get('bank');
    if (!['project', 'global'].includes(scope) ||
      (scope === 'project' && (bank === options.globalBank || !bankAllowed(options.bank, bank)))) {
      return json({ error: '保存长期记忆前，请先选择记忆库。' }, 400);
    }
    const key = createHash('sha256').update(scope + '\n' + bank).digest('hex');
    const file = path.join(directory, key + '.json');
    const load = async () => {
      const data = await readLocalRecord(file, { revision: null, items: [] });
      if (!Array.isArray(data?.items) || (data.revision !== null && typeof data.revision !== 'string')) {
        throw new Error('Invalid notes file');
      }
      return data;
    };
    try {
      if (request.method === 'GET') return json({ data: { ...(await load()), bank } });
      if (request.method !== 'POST') return json({ error: '不支持的长期记忆操作。' }, 405);
      if (!knowledgePostAllowed(request)) return json({ error: '长期记忆写入必须从工作台发起。' }, 403);
      let input;
      try {
        const body = await request.text();
        if (body.length > 20000) return json({ error: '记忆内容过大。' }, 413);
        input = JSON.parse(body);
      } catch {
        return json({ error: '无法读取长期记忆内容。' }, 400);
      }
      const { action, revision, id, type } = input || {};
      const title = typeof input?.title === 'string' ? input.title.trim() : '';
      const content = typeof input?.content === 'string' ? input.content.trim() : '';
      if (!['save', 'archive', 'restore'].includes(action) ||
        (revision !== null && typeof revision !== 'string') ||
        (id !== null && (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))) ||
        (action === 'save' && (!noteTypes.includes(type) || !title || title.length > 120 || !content || content.length > 3000))) {
        return json({ error: '请填写有效的长期记忆分类、标题和正文。' }, 400);
      }
      const pending = writes.then(async () => {
        const current = await load();
        if (current.revision !== revision) return json({ error: '其他窗口已修改记忆。请刷新后重试。' }, 409);
        const previous = current.items.find(item => item.id === id);
        if (id ? !previous : action !== 'save') return json({ error: '找不到指定的长期记忆。' }, 404);
        if (!previous && current.items.length >= 200) return json({ error: '这个库已达到 200 条本机长期记忆上限。' }, 409);
        if (previous?.archived && action === 'save') return json({ error: '请先恢复已归档记忆。' }, 409);
        const updatedAt = new Date().toISOString();
        const item = action === 'save'
          ? { id: id || randomUUID(), type, title, content, updatedAt, archived: false }
          : { ...previous, updatedAt, archived: action === 'archive' };
        const next = { revision: randomUUID(), items: [item, ...current.items.filter(row => row.id !== item.id)] };
        await saveLocalRecord(file, next);
        return json({ data: { ...next, bank } });
      });
      writes = pending.catch(() => {});
      return await pending;
    } catch {
      return json({ error: '无法读取或保存本机长期记忆。' }, 503);
    }
  };
}
