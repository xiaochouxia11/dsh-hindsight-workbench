import { request as httpRequest } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
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
      if (!id || ['.','..'].includes(id) || id.length > 256 || /[\x00-\x1f]/.test(id)) throw new Error('无效的记录 ID');
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

export function readLocal(pathname, signal, options = connectionOptions()) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: options.hostname, port: options.port, path: pathname, method: 'GET', headers: { Accept: 'application/json' }, signal }, res => {
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
        try { resolve(JSON.parse(text)); }
        catch { reject(new Error('后端未返回有效 JSON，未对原文做转码或修复')); }
      });
    });
    req.setTimeout(12000, () => req.destroy(new Error('连接超时，请确认本机 Hindsight 服务正在运行')));
    req.on('error', reject); req.end();
  });
}

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const healthStatus = value => ['healthy','unhealthy','degraded'].includes(value) ? value : 'unknown';
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
    const requestedGlobal = params.get('global');
    if (requestedGlobal !== null && requestedGlobal !== '' && !validBank(requestedGlobal)) return json({ error: '无效的全局库名称' }, 400);
    const bank = bankAllowed(options.bank, requestedBank) ? requestedBank : options.bank;
    const globalBank = bankAllowed(options.globalBank, requestedGlobal) ? requestedGlobal : options.globalBank;
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
        })).filter(b => validBank(b.id) && (b.id === options.globalBank || bankAllowed(options.bank, b.id)));
        return json({ data: { banks, total: banks.length }, encoding: 'utf-8-strict', endpoint: options.endpoint, bank });
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

export function apply(ctx, config = {}) {
  ctx.effect(() => ctx.connection.fetch.register({ path: ROUTE, methods: ['GET'], requestBody:'buffered', fetch:createHandler(readLocal,config,()=>upstreamInventory(ctx.get('pluginManager')),()=>readSkills(config)) }));
}
