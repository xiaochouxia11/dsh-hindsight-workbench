window.__ModuleLoader__.load({
  id: 'dsh-hindsight-workbench',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const PKG = 'dsh-hindsight-workbench';
    const ID = PKG + ':browser';
    const NS = ID;

    const TYPE_LABELS = {
      world: '世界知识', experience: '经历', observation: '观察', opinion: '观点',
      mental_model: '心智模型', procedure: '流程', entity: '实体', fact: '事实',
      procedure_step: '流程步骤', document: '文档', summary: '摘要', note: '笔记',
    };
    const SETUP_STEPS = [
      '通过 DSH 官方插件管理安装本工作台。打开左侧栏的「Hindsight 记忆工作台」确认界面已加载。',
      '在新电脑准备并启动 Hindsight 后端，再点「刷新」检查服务地址和健康状态。',
      '在插件管理中确认只启用一个 Hindsight 采集器。仅浏览已有记忆时，跳过自动抽取所需的本机授权。',
      '项目库是显式绑定的配置，不自动跟随对话目录。先打开项目库，再用已知关键词检索并打开对应原文。',
      '如需验证自动采集，在隔离环境使用一条测试事实，并确认它只落入预期的项目库。',
    ];
    const words = {
      title: 'Hindsight 记忆工作台', subtitle: '本机 Hindsight 记忆、AI 知识库与 Skill', readOnly: '只读',
      refresh: '刷新', back: '回到对话', connected: '已连接', failed: '连接不可用', loading: '正在读取…',
      retry: '重试', search: '搜索', searchHint: '搜索记忆原文或关键词…', clear: '清除',
      scopeProject: '项目库', scopeGlobal: '全局库', scopeBoth: '联合搜索',
      tabFacts: '记忆', tabPages: '知识页', tabKnowledge: 'AI 知识库', tabSkills: '技能', tabEvolution: '进化', tabSetup: '检查',
      bankLabel: '记忆库', skillTag: 'Skill', skillsNote: '这些是本机 DSH 已安装的技能（来自 DSH_HOME/skills），不属于 Hindsight 记忆库。',
      bankOffline: '服务未就绪',
      serviceHint: '本机 Hindsight 服务未运行或未响应。请先启动 hindsight-api（默认 127.0.0.1:9077），再点右上角「刷新」。',
      emptySkills: '还没有可用的技能', skillsUnavailable: '当前宿主还没有加载技能读取接口。', skillsRestart: '技能清单由宿主读取文件系统。若刚更新插件，请重启 DSH 后再打开此页。', emptySkillsHint: '把带 SKILL.md 的技能目录放进 DSH_HOME/skills，刷新后即可在这里看到。',
      total: '事实', links: '关联', docs: '文档', pending: '待处理',
      all: '当前记忆库', items: '条', emptyTitle: '这里还是空的',
      emptyFacts: '没有匹配的记忆。换个关键词，或清空搜索再试。',
      emptyPages: '知识页尚未生成。工作台只浏览已有内容，不会重新抽取。',
      emptySearch: '试试搜索一个项目名、函数名或一句结论。',
      choose: '选择一条记忆，查看它的来龙去脉',
      chooseHint: '左侧是记忆与知识页列表，点开即可阅读原文、上下文、实体与关联。',
      detail: '记忆详情', pageDetail: '知识页',
      source: '来源记忆', context: '上下文', entities: '实体', tags: '标签', metadata: '元数据',
      relations: '关联', loadGraph: '读取已有关系', noRelation: '当前读取范围内没有相连的已有关系。',
      graphHint: '只读取已有关系，不新建、不计算。', limited: '仅显示前 100 条相连关系',
      close: '关闭', prev: '上一页', next: '下一页', page: '第', pageOf: '范围',
      endpoint: '服务', bank: '记忆库', status: '状态', type: '类型', time: '时间',
      unknown: '未提供', suspect: '原文含疑似乱码特征，但 UTF-8 解码成功，原文保持原样。',
      copy: '复制', copied: '已复制', error: '读取失败',
      bothNote: '联合搜索分别读取项目库与全局库各 30 条，按来源分组，不做语义排序。',
      setupTitle: '安装与连接检查', setupHint: '只做检查：不安装、不启用、不启动服务、不创建记忆库。',
      localService: '本机服务', banks: '记忆库', upstream: '上游采集集成', guide: '跨电脑安装引导',
      boundary: '双层记忆边界', encoding: '编码与纠正',
    };

    const HEALTH_LABELS = {
      healthy: '健康',
      degraded: '服务降级',
      unhealthy: '服务异常',
      unknown: '已响应，健康状态未知',
    };

    const css = `
.hbm{--hbm-radius:16px;--hbm-line:var(--dsw-alias-border-l2,rgba(15,23,42,.09));--hbm-text:var(--dsw-alias-label-primary,#0f172a);--hbm-muted:var(--dsw-alias-label-secondary,#64748b);--hbm-faint:var(--dsw-alias-label-tertiary,#94a3b8);--hbm-card:var(--dsw-alias-bg-layer-1,#fff);--hbm-sunken:var(--dsw-alias-bg-layer-2,#f5f6f7);--hbm-accent:#0f766e;--hbm-accent-soft:rgba(15,118,110,.10);--hbm-amber:#b45309;--hbm-danger:#b91c1c;position:relative;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;color:var(--hbm-text);background:
 radial-gradient(1200px 500px at 80% -10%,rgba(20,184,166,.10),transparent 60%),radial-gradient(900px 400px at 0% 0%,rgba(99,102,241,.08),transparent 55%),var(--dsw-alias-bg-base,#f7f7f5);font:inherit;
}
.hbm *{box-sizing:border-box}
.hbm button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0}
.hbm button:disabled{opacity:.45;cursor:default}
.hbm button:focus-visible,.hbm input:focus-visible{outline:2px solid var(--hbm-accent);outline-offset:2px;border-radius:10px}
.hbm .shell{display:flex;flex:1;flex-direction:column;width:100%;min-height:0;padding:22px 26px 0}
.hbm .top{display:flex;align-items:center;gap:14px;padding:2px 2px 18px}
.hbm .brand{display:flex;align-items:center;gap:12px;min-width:0}
.hbm .logo{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;color:#fff;background:linear-gradient(140deg,#0f766e,#0e7490 55%,#4338ca);box-shadow:0 8px 20px rgba(13,148,136,.28)}
.hbm .brand h1{margin:0;font-size:18px;font-weight:650;letter-spacing:-.2px;line-height:1.25}
.hbm .brand p{margin:2px 0 0;font-size:12px;color:var(--hbm-muted)}
.hbm .top-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.hbm .chip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border:1px solid var(--hbm-line);border-radius:999px;background:var(--hbm-card);font-size:12px;color:var(--hbm-muted);white-space:nowrap}
.hbm .chip i{width:7px;height:7px;border-radius:50%;background:var(--hbm-faint);box-shadow:0 0 0 3px rgba(148,163,184,.16)}
.hbm .chip.ok i{background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.16)}
.hbm .chip.bad i{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.16)}
.hbm .btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px;border:1px solid var(--hbm-line);border-radius:10px;background:var(--hbm-card);font-size:13px;font-weight:500;transition:background .16s,border-color .16s,transform .16s}
.hbm .btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--hbm-sunken));border-color:var(--dsw-alias-border-l3,rgba(15,23,42,.16))}
.hbm .btn:active{transform:translateY(1px)}
.hbm .btn.primary{color:#fff;border-color:transparent;background:linear-gradient(135deg,#0f766e,#0e7490)}
.hbm .hero{display:flex;align-items:stretch;gap:16px;padding:18px 20px;border:1px solid var(--hbm-line);border-radius:var(--hbm-radius);background:linear-gradient(180deg,rgba(255,255,255,.86),rgba(255,255,255,.62)),var(--hbm-card);box-shadow:0 1px 2px rgba(15,23,42,.04),0 10px 30px -18px rgba(15,23,42,.25);backdrop-filter:blur(6px)}
.hbm .hero-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px;justify-content:center}
.hbm .eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--hbm-faint);font-weight:600}
.hbm .bank-name{font-size:17px;font-weight:650;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hbm .bank-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hbm .bank-label{font-size:11.5px;color:var(--hbm-faint);letter-spacing:.04em}
.hbm .bank-select{height:36px;max-width:100%;padding:0 30px 0 0;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--hbm-text);font-size:17px;font-weight:650;letter-spacing:-.2px;font-family:inherit;cursor:pointer;appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--hbm-muted) 50%),linear-gradient(135deg,var(--hbm-muted) 50%,transparent 50%);background-position:calc(100% - 13px) 16px,calc(100% - 8px) 16px;background-size:5px 5px,5px 5px;background-repeat:no-repeat;text-overflow:ellipsis}
.hbm .bank-select:hover{background-color:var(--hbm-sunken)}
.hbm .bank-select:focus-visible{outline:2px solid var(--hbm-accent);outline-offset:2px}
.hbm .bank-count{font-size:11.5px;color:var(--hbm-faint)}
.hbm .skills{display:flex;flex-direction:column;gap:12px;padding:4px 2px}
.hbm .skills-note{margin:0;font-size:12px;line-height:1.7;color:var(--hbm-faint)}
.hbm .skill-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.hbm .skill-card{padding:14px 16px;border:1px solid var(--hbm-line);border-radius:13px;background:var(--hbm-card);display:flex;flex-direction:column;gap:8px;transition:border-color .15s ease,box-shadow .15s ease}
.hbm .skill-card:hover{border-color:var(--hbm-accent);box-shadow:0 6px 22px -14px var(--hbm-accent)}
.hbm .skill-card:hover .skill-top b{color:var(--hbm-accent)}
.hbm .skill-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.hbm .skill-top b{font-size:13.5px;font-weight:650;line-height:1.45;word-break:break-word}
.hbm .skill-card p{margin:0;font-size:12.5px;line-height:1.6;color:var(--hbm-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:calc(1.6em * 2);flex:none}
.hbm .skill-id{flex:none;margin-top:auto;font-size:11px;color:var(--hbm-faint);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hbm .scopes{display:inline-flex;align-self:flex-start;gap:2px;padding:3px;border:1px solid var(--hbm-line);border-radius:11px;background:var(--hbm-sunken)}
.hbm .scopes button{height:28px;padding:0 12px;border-radius:8px;font-size:12.5px;color:var(--hbm-muted);transition:background .16s,color .16s,box-shadow .16s}
.hbm .scopes button:hover{color:var(--hbm-text)}
.hbm .scopes button[aria-pressed="true"]{color:var(--hbm-text);background:var(--hbm-card);box-shadow:0 1px 2px rgba(15,23,42,.12);font-weight:600}
.hbm .metrics{display:grid;grid-template-columns:repeat(4,minmax(84px,1fr));gap:10px;flex:0 0 auto}
.hbm .metric{min-width:84px;padding:11px 13px;border:1px solid var(--hbm-line);border-radius:12px;background:var(--hbm-sunken)}
.hbm .metric b{display:block;font-size:21px;font-weight:700;letter-spacing:-.4px;line-height:1.15;font-variant-numeric:tabular-nums}
.hbm .metric span{display:block;margin-top:3px;font-size:11.5px;color:var(--hbm-muted)}
.hbm .metric.hot b{color:var(--hbm-amber)}
.hbm .toolbar{display:flex;align-items:center;gap:12px;padding:16px 2px 12px;flex-wrap:wrap}
.hbm .tablist{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:var(--hbm-sunken);border:1px solid var(--hbm-line)}
.hbm .tablist button{height:30px;padding:0 14px;border-radius:8px;font-size:13px;color:var(--hbm-muted)}
.hbm .tablist button[aria-selected="true"]{background:var(--hbm-card);color:var(--hbm-text);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.10)}
.hbm .search{position:relative;display:flex;align-items:center;flex:1;min-width:180px;max-width:420px}
.hbm .search input{width:100%;height:36px;padding:0 34px 0 34px;border:1px solid var(--hbm-line);border-radius:10px;background:var(--hbm-card);color:var(--hbm-text);font-size:13px}
.hbm .search input::placeholder{color:var(--hbm-faint)}
.hbm .search .mag{position:absolute;left:11px;color:var(--hbm-faint);pointer-events:none;display:flex}
.hbm .search .clr{position:absolute;right:6px;display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:var(--hbm-faint)}
.hbm .search .clr:hover{background:var(--hbm-sunken);color:var(--hbm-text)}
.hbm .hint{font-size:12px;color:var(--hbm-muted)}
.hbm .notice{display:flex;gap:10px;align-items:flex-start;padding:11px 14px;margin:0 0 10px;border:1px solid rgba(180,83,9,.24);border-radius:12px;background:rgba(245,158,11,.09);color:var(--hbm-amber);font-size:12.5px;line-height:1.6}
.hbm .notice.error{border-color:rgba(185,28,28,.22);background:rgba(185,28,28,.07);color:var(--hbm-danger)}
.hbm .content{display:flex;flex:1;min-height:0;gap:16px;padding-bottom:0}
.hbm .list-pane{display:flex;flex-direction:column;width:390px;min-width:300px;min-height:0;border:1px solid var(--hbm-line);border-radius:var(--hbm-radius) var(--hbm-radius) 0 0;background:var(--hbm-card);overflow:hidden}
.hbm .list-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--hbm-line);font-size:12px;color:var(--hbm-muted)}
.hbm .list-head b{color:var(--hbm-text);font-weight:600}
.hbm .list-head .spacer{flex:1}
.hbm .list-scroll{flex:1;min-height:0;overflow:auto;padding:8px;scrollbar-width:thin}
.hbm .card{display:block;width:100%;text-align:left;padding:12px 13px;margin-bottom:6px;border:1px solid transparent;border-radius:12px;transition:background .14s,border-color .14s}
.hbm .card:hover{background:var(--hbm-sunken)}
.hbm .card[aria-current="true"]{background:var(--hbm-accent-soft);border-color:rgba(15,118,110,.28)}
.hbm .card .meta{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px;color:var(--hbm-faint)}
.hbm .tag{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;background:var(--hbm-sunken);font-size:11px;color:var(--hbm-muted)}
.hbm .tag.src{background:rgba(99,102,241,.10);color:#4f46e5}
.hbm .tag.type{background:var(--hbm-accent-soft);color:var(--hbm-accent)}
.hbm .card p{margin:0;font-size:13px;line-height:1.55;color:var(--hbm-text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.hbm .pager{display:flex;align-items:center;gap:4px;padding:10px 12px;border-top:1px solid var(--hbm-line);font-size:12px;color:var(--hbm-muted)}
.hbm .pager .spacer{flex:1}
.hbm .pager button{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 9px;border-radius:8px;border:1px solid var(--hbm-line);background:var(--hbm-card);font-size:12px}
.hbm .pager button:hover:not(:disabled){background:var(--hbm-sunken)}
.hbm .detail-pane{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;border:1px solid var(--hbm-line);border-radius:var(--hbm-radius) var(--hbm-radius) 0 0;background:var(--hbm-card);overflow:hidden}
.hbm .detail-scroll{flex:1;min-height:0;overflow:auto;padding:22px 26px 26px;scrollbar-width:thin}
.hbm .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;min-height:220px;padding:30px;text-align:center;color:var(--hbm-muted)}
.hbm .empty .art{display:grid;place-items:center;width:74px;height:74px;border-radius:22px;background:var(--hbm-sunken);color:var(--hbm-faint)}
.hbm .empty h2{margin:4px 0 0;font-size:15px;font-weight:600;color:var(--hbm-text)}
.hbm .empty p{margin:0;max-width:340px;font-size:12.5px;line-height:1.7}
.hbm .skeleton{height:72px;margin-bottom:8px;border-radius:12px;background:linear-gradient(90deg,var(--hbm-sunken) 25%,rgba(148,163,184,.16) 37%,var(--hbm-sunken) 63%);background-size:400% 100%;animation:hbmShine 1.3s ease infinite}
@keyframes hbmShine{0%{background-position:100% 0}100%{background-position:-100% 0}}
.hbm .detail-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px}
.hbm .detail-head h2{margin:0;font-size:18px;font-weight:650;letter-spacing:-.2px;line-height:1.35;overflow-wrap:anywhere}
.hbm .detail-head .acts{margin-left:auto;display:flex;gap:6px;flex:0 0 auto}
.hbm .iconbtn{display:grid;place-items:center;width:30px;height:30px;border:1px solid var(--hbm-line);border-radius:9px;background:var(--hbm-card);color:var(--hbm-muted)}
.hbm .iconbtn:hover{background:var(--hbm-sunken);color:var(--hbm-text)}
.hbm .chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 18px}
.hbm .chips .tag{height:22px;padding:0 9px;border:1px solid var(--hbm-line);background:transparent}
.hbm .prose{margin:0;font-size:13.5px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--hbm-text)}
.hbm .section{margin-top:22px;padding-top:18px;border-top:1px solid var(--hbm-line)}
.hbm .section h3{margin:0 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hbm-faint);font-weight:650}
.hbm .section p{margin:0;font-size:13px;line-height:1.75;color:var(--hbm-text);overflow-wrap:anywhere;white-space:pre-wrap}
.hbm .section .muted{color:var(--hbm-muted);font-size:12.5px}
.hbm .kv{display:grid;grid-template-columns:88px 1fr;gap:6px 12px;font-size:12.5px}
.hbm .kv dt{color:var(--hbm-muted)}
.hbm .kv dd{margin:0;color:var(--hbm-text);overflow-wrap:anywhere}
.hbm .linkrow{display:block;width:100%;text-align:left;padding:10px 12px;margin:6px 0;border:1px solid var(--hbm-line);border-radius:10px;font-size:12.5px;line-height:1.55;background:var(--hbm-card)}
.hbm .linkrow:hover{background:var(--hbm-sunken)}
.hbm .pill-list{display:flex;flex-wrap:wrap;gap:6px}
.hbm .pill-list .tag{height:24px;padding:0 9px}
.hbm .setup,.hbm .workbench-editor{max-width:880px}
.hbm .workbench-editor{margin:0 0 18px;display:grid;gap:12px;justify-items:start}
.hbm .workbench-editor h2,.hbm .workbench-editor h3{margin:0}
.hbm .workbench-editor form,.hbm .workbench-editor label{display:grid;gap:6px;width:100%;color:var(--hbm-text)}
.hbm .workbench-editor form{padding:14px;gap:12px;border:1px solid var(--hbm-line);border-radius:12px}
.hbm .workbench-editor input,.hbm .workbench-editor select,.hbm .workbench-editor textarea{width:100%;padding:8px 10px;border:1px solid var(--hbm-line);border-radius:8px;background:var(--hbm-card);color:var(--hbm-text);font:inherit}
.hbm .workbench-editor textarea{resize:vertical}
.hbm .workbench-editor .btn{width:fit-content}
.hbm .workbench-editor .check-option{display:flex;align-items:center;gap:8px}.hbm .check-option input{width:auto}
.hbm .workbench-editor .box{padding:10px 12px;border:1px solid var(--hbm-line);border-radius:10px;overflow-wrap:anywhere}
.hbm .workbench-editor .notice{margin:0}
.hbm .memory-history ol{padding-left:18px;display:grid;gap:10px;color:var(--hbm-muted);overflow-wrap:anywhere}
.hbm .memory-history time{font-variant-numeric:tabular-nums}.hbm .memory-history .prose{margin:3px 0}
.hbm .knowledge-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(275px,100%),1fr));gap:12px;align-items:start;width:100%}
.hbm .setup h3{margin:20px 0 8px;font-size:13px;font-weight:650}
.hbm .setup p,.hbm .setup li{font-size:12.8px;line-height:1.75;color:var(--hbm-muted)}
.hbm .setup ol{padding-left:18px;margin:0}
.hbm .setup .box{padding:12px 14px;border:1px solid var(--hbm-line);border-radius:12px;background:var(--hbm-sunken);font-size:12.5px;line-height:1.7;margin:8px 0}
.hbm .setup .box b{color:var(--hbm-text)}
.hbm .foot{display:flex;align-items:center;gap:10px;padding:10px 2px 12px;font-size:11.5px;color:var(--hbm-faint)}
.hbm .foot .spacer{flex:1}
.hbm .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:1080px){.hbm .metrics{grid-template-columns:repeat(2,minmax(84px,1fr))}.hbm .list-pane{width:330px}}
@media (max-width:860px){.hbm .shell{padding:16px 14px 0}.hbm .hero{flex-direction:column}.hbm .metrics{grid-template-columns:repeat(4,1fr)}.hbm .content{flex-direction:column}.hbm .list-pane{width:100%;min-width:0;flex:1}.hbm .detail-pane{display:none}.hbm .content.show-detail .list-pane{display:none}.hbm .content.show-detail .detail-pane{display:flex;flex:1}.hbm .brand p{display:none}}
@media (prefers-color-scheme:dark){.hbm{--hbm-line:rgba(148,163,184,.18);--hbm-card:rgba(30,41,59,.72);--hbm-sunken:rgba(148,163,184,.10)}.hbm .hero{background:linear-gradient(180deg,rgba(30,41,59,.80),rgba(15,23,42,.55))}}
`;

    const Icon = ({ size = 20 }) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
      h('path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15.5A2.5 2.5 0 0 1 16.5 21H6.5A2.5 2.5 0 0 1 4 18.5z', stroke: 'currentColor', strokeWidth: 1.7, strokeLinejoin: 'round' }),
      h('path', { d: 'M8 7.5h7M8 11h7M8 14.5h4.5', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
      h('circle', { cx: 16.4, cy: 17.2, r: 1.4, fill: 'currentColor' }));
    const Mag = () => h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }, h('circle', { cx: 11, cy: 11, r: 6.4, stroke: 'currentColor', strokeWidth: 1.8 }), h('path', { d: 'm16 16 4 4', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }));
    const X = ({ size = 14 }) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }, h('path', { d: 'M6 6l12 12M18 6 6 18', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }));
    const Copy = () => h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }, h('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2.2, stroke: 'currentColor', strokeWidth: 1.6 }), h('path', { d: 'M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }));
    const Arrow = ({ dir = 'right' }) => h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }, h('path', { d: dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
    const Art = () => h('svg', { width: 34, height: 34, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
      h('path', { d: 'M4 6.5A2.5 2.5 0 0 1 6.5 4H19v14.5A2.5 2.5 0 0 1 16.5 21H6.5A2.5 2.5 0 0 1 4 18.5z', stroke: 'currentColor', strokeWidth: 1.4 }),
      h('path', { d: 'M8 9h7M8 12.5h5', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }));

    function formatTime(value) {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
      const p = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    const typeLabel = value => TYPE_LABELS[value] || (value ? String(value) : '—');

    return {
      inject: ['slots', 'layout', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: words, en: words }));
        const t = ctx.locale.bind(NS);
        const label = key => t(key);

        const connection = { bank: '' };

        async function api(op, args = {}, signal) {
          const qs = new URLSearchParams({ op, ...args });
          if (connection.bank) qs.set('bank', connection.bank);
          let res, data;
          try {
            res = await fetch('/api/hindsight-workbench?' + qs, { credentials: 'same-origin', signal, cache: 'no-store' });
            data = await res.json();
          } catch (error) {
            if (signal && signal.aborted) throw error;
            throw new Error('无法读取插件宿主响应，请确认 DSH 连接和插件服务正常后重试。');
          }
          if (!res.ok) throw new Error(data.error || label('error'));
          if (op === 'status') return { ...data.data, connection: { endpoint: data.endpoint, bank: data.bank } };
          return data.data;
        }

        const skillManager = '/api/michengai/dsh-skills-manager';
        const knowledge = '/api/hindsight-workbench/knowledge';

        async function companionRequest(path, body, signal) {
          const skill = path.startsWith(skillManager + '/');
          const headers = body === undefined ? {} : {
            'Content-Type': 'application/json',
            ...(skill ? { 'x-dsh-skills-manager': '1' } : { 'x-hindsight-workbench': '1' }),
          };
          let response;
          let result;
          try {
            response = await fetch(path, {
              method: body === undefined ? 'GET' : 'POST',
              credentials: 'same-origin', cache: 'no-store', headers,
              body: body === undefined ? undefined : JSON.stringify(body),
              signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000),
            });
            result = await response.json();
          } catch (error) {
            if (signal?.aborted) throw error;
            if (response?.status === 404) throw new Error(skill ? '请先在插件管理中安装并启用 DSH 技能管理器（@michengai/dsh-skills-manager）。' : '请核对 Hindsight 服务和工作台的已加载版本。');
            throw new Error(body === undefined ? '无法读取配套插件响应。' : '没有收到确认。请先刷新清单，确认操作是否已完成。');
          }
          if (response.status === 404 && !result?.error) {
            throw new Error(skill ? '技能管理器未加载。' : '知识库插件未加载。');
          }
          if (!response.ok || !result || (skill ? result.ok !== true : !Object.hasOwn(result, 'data'))) {
            const message = typeof result?.error === 'string' ? result.error : result?.error?.message;
            throw new Error(typeof message === 'string' ? message.slice(0, 300) : '配套插件操作失败（HTTP ' + response.status + '）。');
          }
          return result.data;
        }

        function operationStatus(status) {
          return status.error || status.message
            ? h('p', { role: 'status', className: status.error ? 'notice error' : 'notice' }, status.error || status.message)
            : null;
        }

        function workbenchField(labelText, props, multiline = false) {
          return h('label', null, labelText, h(multiline ? 'textarea' : 'input', props));
        }

        function SkillCreator({ onCreated, evidence, onDiscard, saved, onSaveDraft }) {
          const [name, setName] = React.useState(saved?.name || '');
          const [description, setDescription] = React.useState(saved?.description || '');
          const [body, setBody] = React.useState(saved?.body || '');
          const [status, setStatus] = React.useState({});
          const [available, setAvailable] = React.useState(null);
          const [includeEvidence, setIncludeEvidence] = React.useState(saved?.includeEvidence ?? true);
          const busy = React.useRef(false);

          async function open() {
            setAvailable('loading'); setStatus({});
            try {
              await companionRequest(skillManager + '/sidebar-entry');
              setAvailable(true);
            } catch (error) {
              setAvailable(false); setStatus({ error: error.message });
            }
          }

          async function save(event) {
            event.preventDefault();
            if (busy.current) return;
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name.trim()) || !description.trim() || !body.trim()) {
              setStatus({ error: '请填写合法的技能 ID、简介和正文。' });
              return;
            }
            setStatus({ busy: true }); busy.current = true;
            try {
              const source = evidence && includeEvidence
                ? '\n\n## 来源\n\nHindsight 记忆：' + evidence.scopeLabel + ' · ' + evidence.id + '\n' : '';
              await companionRequest(skillManager + '/create', { root: 'dsh', name: name.trim(), description: description.trim(), body: body + source });
              setStatus({ message: 'Skill 已添加到 Harness，由技能管理器刷新可用清单。' });
              setName(''); setDescription(''); setBody(''); await onCreated();
            } catch (error) {
              setStatus({ error: error.message });
            } finally {
              busy.current = false;
            }
          }

          async function persist() {
            if (busy.current) return;
            busy.current = true; setStatus({ busy: true });
            try {
              await onSaveDraft({ evidence, name, description, body, includeEvidence });
              setStatus({ message: '已保存到本机。重开工作台后可继续编辑。' });
            } catch (error) { setStatus({ error: error.message }); }
            finally { busy.current = false; }
          }

          return h('div', { className: 'workbench-editor' },
            evidence ? h('div', { className: 'box' },
              h('h3', null, '草稿依据'), h('p', null, evidence.scopeLabel + ' · ' + evidence.id),
              h('p', { className: 'prose' }, evidence.text),
              h('button', { type: 'button', className: 'btn', disabled: !!status.busy, onClick: onDiscard }, '放弃草稿')) : null,
            available === true ? h('form', { onSubmit: save },
              h('h3', null, '添加 Skill'),
              workbenchField('技能 ID（小写字母、数字和连字符）', { required: true, pattern: '[a-z0-9]+(?:-[a-z0-9]+)*', maxLength: 64, value: name, onChange: e => setName(e.target.value) }),
              workbenchField('简介', { required: true, maxLength: 500, value: description, onChange: e => setDescription(e.target.value) }),
              workbenchField('技能正文（Markdown）', { required: true, rows: 6, maxLength: 64000, value: body, onChange: e => setBody(e.target.value) }, true),
              evidence ? h('label', { className: 'check-option' }, h('input', {
                type: 'checkbox', checked: includeEvidence, onChange: e => setIncludeEvidence(e.target.checked),
              }), '在 Skill 中保留来源引用') : null,
              h('button', { type: 'submit', className: 'btn', disabled: !!status.busy }, status.busy ? '正在保存…' : '保存到 Harness Skills'))
              : h('button', { type: 'button', className: 'btn', onClick: open, disabled: available === 'loading' }, available === 'loading' ? '正在检查…' : '添加 Skill'),
            onSaveDraft ? h('button', { type: 'button', className: 'btn', disabled: !!status.busy, onClick: persist }, '保存本机草稿') : null,
            operationStatus(status));
        }

        function LearningJournal({ bank, scope, onDraft, canDraft }) {
          const [data, setData] = React.useState(null);
          const [status, setStatus] = React.useState({ busy: true });
          const [showArchived, setShowArchived] = React.useState(false);
          const route = '/api/hindsight-workbench/learning?' + new URLSearchParams({ scope, bank });
          React.useEffect(() => {
            const controller = new AbortController();
            companionRequest(route, undefined, controller.signal).then(value => {
              if (!controller.signal.aborted) { setData(value); setStatus({}); }
            }, error => { if (!controller.signal.aborted) setStatus({ error: error.message }); });
            return () => controller.abort();
          }, [route]);

          async function archive(item) {
            setStatus({ busy: true });
            try { setData(await companionRequest(route, { id: item.id, action: item.archived ? 'restore' : 'archive' })); setStatus({}); }
            catch (error) { setStatus({ error: error.message }); }
          }

          const kinds = { correction: '纠正', preference: '偏好', instruction: '重复指令', workflow: '验证流程' };
          const states = { durable: '已记住', candidate: '待积累', ready: '可提炼', adopted: '已采用' };
          const steps = { inspect: '检查现有状态', edit: '实施修改', build: '构建', test: '运行测试', check: '运行静态检查' };
          const entries = data?.entries.filter(item => !!item.archived === showArchived) || [];
          return h('div', { className: 'box' }, h('h3', null, scope === 'global' ? '全局自动记忆' : '项目进化日志'),
            operationStatus(status),
            h('label', { className: 'check-option' }, h('input', { type: 'checkbox', checked: showArchived,
              onChange: event => setShowArchived(event.target.checked) }), '查看归档'),
            ...(entries.length ? entries.map(item => h('article', { className: 'box', key: item.id },
              h('p', null, kinds[item.kind] + ' · ' + states[item.status] + ' · ' + item.sources.length + ' 个会话'),
              h('p', { className: 'prose' }, item.text),
              item.previous ? h('p', { className: 'skills-note' }, '旧记录 · ' + item.previous) : null,
              h('details', null, h('summary', null, '查看证据'),
                ...item.sources.map(source => h('p', { key: source.id }, source.date.slice(0, 10) + ' · ' + source.id))),
              canDraft && !item.archived && item.status === 'ready' ? h('button', { type: 'button', className: 'btn',
                onClick: () => onDraft({
                  evidence: { id: item.id, scopeLabel: ('项目流程 · ' + bank).slice(0, 64), learningBank: bank,
                    text: item.text + '。独立验证：' + item.sources.map(source => source.id).join('、') },
                  name: 'workflow-' + item.id.slice(0, 10),
                  description: item.text,
                  body: '## 操作步骤\n\n' + item.steps.map((step, i) => (i + 1) + '. ' + steps[step]).join('\n'),
                  includeEvidence: true,
                }) }, '打开 Skill 草稿') : null,
              h('button', { type: 'button', className: 'btn', disabled: !!status.busy, onClick: () => archive(item) },
                item.archived ? '恢复' : '归档'))) : [data ? h('p', { key: 'empty' }, '暂无记录。') : null]),
            scope === 'project' && data?.reviews.length ? h('details', null, h('summary', null, '任务复盘'),
              ...data.reviews.map(review => h('p', { key: review.id }, review.date.slice(0, 10) + ' · ' +
                review.steps.map(step => steps[step]).join(' → ') + ' · ' +
                (review.verified ? '有验证通过记录' : '缺少完整验证') +
                (review.failed ? ' · ' + review.failed + ' 步失败，检查失败步骤后重新验证' : '')))) : null);
        }

        function EvolutionWorkspace({ evidence, bank, scope, onDiscard, onCreated }) {
          const route = '/api/hindsight-workbench/evolution';
          const [stored, setStored] = React.useState(null);
          const [status, setStatus] = React.useState({ busy: true });
          const [restored, setRestored] = React.useState(null);
          const [savedHere, setSavedHere] = React.useState(null);
          const [candidate, setCandidate] = React.useState(null);
          React.useEffect(() => {
            const controller = new AbortController();
            companionRequest(route, undefined, controller.signal).then(data => {
              if (!controller.signal.aborted) { setStored(data); setStatus({}); }
            }, error => { if (!controller.signal.aborted) setStatus({ error: error.message }); });
            return () => controller.abort();
          }, []);
          const active = evidence || restored?.evidence || candidate?.evidence;

          async function write(draft) {
            if (!stored) throw new Error('尚未读取本机草稿。');
            const data = await companionRequest(route, { revision: stored.revision, draft });
            setStored(data);
          }

          async function clear() {
            setStatus({ busy: true });
            try { await write(null); setRestored(null); setStatus({}); }
            catch (error) { setStatus({ error: error.message }); }
          }

          async function adopted() {
            if (active?.learningBank) {
              try {
                const route = '/api/hindsight-workbench/learning?' + new URLSearchParams({
                  scope: 'project', bank: active.learningBank,
                });
                await companionRequest(route, { id: active.id, action: 'adopt' });
              } catch (error) {
                setStatus({ error: 'Skill 已添加，候选采用状态未更新。' + error.message });
                return;
              }
            }
            if (stored?.draft && (restored || savedHere === active)) {
              try { await write(null); }
              catch (error) {
                setStatus({ error: 'Skill 已添加，草稿仍保留。' + error.message });
                return;
              }
            }
            onCreated();
          }

          async function saveDraft(draft) {
            await write(draft);
            setSavedHere(active);
          }

          return h('div', { className: 'workbench-editor' }, h('h2', null, '进化'),
            scope === 'both' ? h('p', { className: 'skills-note' }, '请选择项目库或全局库，查看自动记忆与复盘。') : null,
            operationStatus(status),
            stored?.draft ? h('div', { className: 'box' },
              h('p', null, '本机已保存草稿 · ' + (stored.draft.name || stored.draft.evidence.id)),
              h('button', { type: 'button', className: 'btn', disabled: !!evidence || !!restored || !!status.busy,
                onClick: () => setRestored(stored.draft) }, '继续编辑已保存草稿'),
              h('button', { type: 'button', className: 'btn', disabled: !!active || !!status.busy,
                onClick: clear }, '清除已保存草稿')) : null,
            bank && scope !== 'both' ? h(LearningJournal, { key: scope + bank, bank, scope, onDraft: setCandidate, canDraft: !active }) : null,
            active ? h(SkillCreator, { key: active.id, evidence: active, saved: evidence ? null : restored || candidate,
              onDiscard: () => { setRestored(null); setCandidate(null); setSavedHere(null); onDiscard(); }, onCreated: adopted,
              onSaveDraft: stored && (!stored.draft || restored || savedHere === active) ? saveDraft : null })
              : h('p', { className: 'skills-note' }, '打开一条记忆，选择「提炼为 Skill 草稿」。确认来源后，填写可复用的步骤并保存。'));
        }

        const noteTypes = { preference: '偏好', project: '项目事实', experience: '经验' };

        function LongTermNotes({ bank, scope }) {
          const params = new URLSearchParams({ scope, ...(scope === 'project' ? { bank } : {}) });
          const route = '/api/hindsight-workbench/notes?' + params;
          const [store, setStore] = React.useState(null);
          const [status, setStatus] = React.useState({ busy: true });
          const [query, setQuery] = React.useState('');
          const [archived, setArchived] = React.useState(false);
          const [form, setForm] = React.useState({ id: null, title: '', content: '', type: 'preference' });
          const active = React.useRef(false);

          async function load(signal) {
            setStatus({ busy: true });
            try {
              const data = await companionRequest(route, undefined, signal);
              if (!signal?.aborted) { setStore(data); setStatus({}); }
            } catch (error) {
              if (!signal?.aborted) setStatus({ error: error.message });
            }
          }

          React.useEffect(() => {
            const controller = new AbortController();
            void load(controller.signal);
            return () => controller.abort();
          }, [route]);

          async function update(action, fields) {
            if (!store || active.current) return;
            active.current = true; setStatus({ busy: true });
            try {
              setStore(await companionRequest(route, { revision: store.revision, action, ...fields }));
              if (action === 'save' || fields.id === form.id) {
                setForm({ id: null, title: '', content: '', type: 'preference' });
              }
              setStatus({ message: { save: '长期记忆已保存。', archive: '已归档，可以恢复。', restore: '长期记忆已恢复。' }[action] });
            } catch (error) { setStatus({ error: error.message }); }
            finally { active.current = false; }
          }

          const search = query.trim().normalize('NFKC').toLowerCase();
          const items = (store?.items || []).filter(item => item.archived === archived
            && [item.title, item.content, noteTypes[item.type]].some(value => value.normalize('NFKC').toLowerCase().includes(search)));
          return h('div', { className: 'workbench-editor' },
            h('h2', null, '长期记忆'),
            h('p', null, store ? (scope === 'global' ? '全局库' : '项目库') + ' · ' + store.bank
              : scope === 'project' && !bank ? '请先选择项目记忆库。' : '正在读取本机记忆库。'),
            h('p', { className: 'skills-note' }, '手动保存的偏好、项目事实和经验独立留在本机，支持跨会话查找。'),
            operationStatus(status),
            h('button', { type: 'button', className: 'btn', disabled: !!status.busy, onClick: () => load() }, '刷新长期记忆'),
            store ? h(React.Fragment, null,
              h('form', { onSubmit: event => { event.preventDefault(); void update('save', form); } },
                h('h3', null, form.id ? '编辑长期记忆' : '记住一件事'),
                h('label', null, '分类', h('select', { value: form.type, onChange: event => setForm({ ...form, type: event.target.value }) },
                  Object.entries(noteTypes).map(([type, title]) => h('option', { key: type, value: type }, title)))),
                workbenchField('标题', { required: true, maxLength: 120, value: form.title, onChange: event => setForm({ ...form, title: event.target.value }) }),
                workbenchField('要记住的内容', { required: true, maxLength: 3000, rows: 4, value: form.content, onChange: event => setForm({ ...form, content: event.target.value }) }, true),
                h('button', { type: 'submit', className: 'btn', disabled: !!status.busy }, '保存长期记忆'),
                form.id ? h('button', { type: 'button', className: 'btn', disabled: !!status.busy,
                  onClick: () => setForm({ id: null, title: '', content: '', type: 'preference' }) }, '取消编辑') : null),
              workbenchField('搜索长期记忆', { maxLength: 500, value: query, onChange: event => setQuery(event.target.value) }),
              h('label', { className: 'check-option' }, h('input', { type: 'checkbox', checked: archived, onChange: event => setArchived(event.target.checked) }), '查看已归档'),
              items.length ? items.map(item => h('article', { className: 'box', key: item.id },
                h('h3', null, item.title), h('span', { className: 'tag type' }, noteTypes[item.type]),
                h('p', { className: 'prose' }, item.content),
                item.archived ? null : h('button', { type: 'button', className: 'btn', disabled: !!status.busy, onClick: () => setForm(item) }, '编辑'),
                h('button', { type: 'button', className: 'btn', disabled: !!status.busy,
                  onClick: () => update(item.archived ? 'restore' : 'archive', { id: item.id }) }, item.archived ? '恢复' : '归档')))
                : h('p', { className: 'skills-note' }, '当前没有匹配的长期记忆。')) : null);
        }

        function KnowledgeWorkspace() {
          const [bases, setBases] = React.useState([]);
          const [baseId, setBaseId] = React.useState('');
          const [name, setName] = React.useState('');
          const [title, setTitle] = React.useState('');
          const [content, setContent] = React.useState('');
          const [query, setQuery] = React.useState('');
          const [hits, setHits] = React.useState(null);
          const [source, setSource] = React.useState(null);
          const [status, setStatus] = React.useState({ busy: true });
          const [available, setAvailable] = React.useState(false);
          const [indexing, setIndexing] = React.useState(null);
          const busy = React.useRef(false);
          const draft = React.useRef(null);
          const hasBase = bases.some(item => item.id === baseId);

          async function load(signal) {
            const list = await companionRequest(knowledge + '?op=list', undefined, signal);
            if (!Array.isArray(list)) throw new Error('知识库返回了无法识别的清单。');
            if (signal?.aborted) return;
            setBases(list); setAvailable(true);
            setBaseId(previous => list.some(item => item.id === previous) ? previous : list[0]?.id || '');
          }

          React.useEffect(() => {
            const controller = new AbortController();
            load(controller.signal).then(() => { if (!controller.signal.aborted) setStatus({}); }, error => {
              if (!controller.signal.aborted) setStatus({ error: error.message });
            });
            return () => controller.abort();
          }, []);

          async function run(task) {
            if (busy.current) return;
            busy.current = true; setStatus({ busy: true });
            try { setStatus({ message: await task() }); }
            catch (error) { setStatus({ error: error.message }); }
            finally { busy.current = false; }
          }

          function create(event) {
            event.preventDefault();
            if (!name.trim()) return;
            void run(async () => {
              const created = await companionRequest(knowledge + '?op=create', { name: name.trim() });
              if (!created?.id) throw new Error('未收到新库 ID，请刷新清单确认。');
              setName(''); setHits(null); setSource(null);
              const success = '已创建知识库「' + (created.name || name.trim()) + '」。';
              try { await load(); setBaseId(created.id); }
              catch { return success + ' 清单暂未更新，请刷新知识库。'; }
              return success;
            });
          }

          function add(event) {
            event.preventDefault();
            if (!hasBase || !title.trim() || !content.trim()) return;
            void run(async () => {
              if (draft.current?.bank !== baseId || draft.current?.title !== title || draft.current?.content !== content) {
                draft.current = { bank: baseId, title, content, documentId: 'hbm-doc-' + crypto.randomUUID() };
              }
              const doc = await companionRequest(knowledge + '?op=ingest', draft.current);
              if (doc?.status !== 'pending') throw new Error('未取得文档提交确认，草稿已保留。');
              setHits(null); setSource(null);
              setIndexing({ bank: baseId, id: doc.id, title: title.trim(), status: 'pending' });
            });
          }

          React.useEffect(() => {
            if (!indexing || indexing.status !== 'pending') return;
            const controller = new AbortController();
            const deadline = Date.now() + 120000;
            let timer;
            const poll = async () => {
              const params = new URLSearchParams({ op: 'document', bank: indexing.bank, id: indexing.id });
              try {
                const doc = await companionRequest(knowledge + '?' + params, undefined, controller.signal);
                if (controller.signal.aborted) return;
                if (doc.status === 'ready' || doc.status === 'failed') {
                  setIndexing({ ...indexing, ...doc }); return;
                }
              } catch {
                if (controller.signal.aborted) return;
              }
              if (Date.now() < deadline) timer = setTimeout(poll, 1500);
              else setIndexing({ ...indexing, status: 'unknown' });
            };
            void poll();
            return () => { controller.abort(); clearTimeout(timer); };
          }, [indexing]);

          function search(event) {
            event.preventDefault();
            if (!hasBase || !query.trim()) return;
            setSource(null); setHits(null);
            void run(async () => {
              const result = await companionRequest(knowledge + '?op=search', { bank: baseId, query: query.trim() });
              if (!Array.isArray(result)) throw new Error('知识库返回了无法识别的搜索结果。');
              setHits(result);
            });
          }

          function readSource(hit) {
            void run(async () => {
              const params = new URLSearchParams({ op: 'source', bank: baseId, id: hit.id });
              const item = await companionRequest(knowledge + '?' + params);
              if (typeof item?.text !== 'string') throw new Error('这个文档的原文预览不可用。');
              setSource({ title: hit.title, text: item.text, truncated: item.truncated });
            });
          }

          return h('div', { className: 'workbench-editor' },
            h('h2', null, 'AI 知识库'),
            h('p', { className: 'skills-note' }, '使用 Hindsight 原生知识库。文本和 Markdown 导入后可检索，并查看命中的原文。'),
            h('button', { type: 'button', className: 'btn', disabled: !!status.busy, onClick: () => run(() => load()) }, '刷新知识库'),
            operationStatus(status),
            available ? h(React.Fragment, null,
              h('form', { onSubmit: create },
                workbenchField('新知识库名称', { required: true, maxLength: 64, value: name, onChange: e => setName(e.target.value) }),
                h('button', { type: 'submit', className: 'btn', disabled: !!status.busy }, '创建知识库')),
              bases.length ? h('label', null, '选择知识库', h('select', {
                value: baseId, disabled: !!status.busy,
                onChange: e => { setBaseId(e.target.value); setHits(null); setSource(null); },
              }, h('option', { value: '', disabled: true }, '请选择'), bases.map(item => h('option', { key: item.id, value: item.id }, item.name)))) : null,
              hasBase ? h('div', { className: 'knowledge-actions' },
                h('form', { onSubmit: add },
                  h('h3', null, '导入文本'),
                  workbenchField('文档标题', { required: true, maxLength: 160, value: title, onChange: e => setTitle(e.target.value) }),
                  workbenchField('文本或 Markdown', { required: true, rows: 6, maxLength: 100000, value: content, onChange: e => setContent(e.target.value) }, true),
                  workbenchField('从文件读取（.txt 或 .md）', {
                    type: 'file', accept: '.txt,.md', disabled: !!status.busy,
                    onChange: async e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (!/\.(?:txt|md)$/i.test(file.name) || file.size > 400000) {
                        setStatus({ error: '请选择不超过 400 KB 的 .txt 或 .md 文件。' }); return;
                      }
                      try {
                        const raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
                        if (raw.length > 100000) throw new Error();
                        setTitle(file.name); setContent(raw); setStatus({});
                      } catch { setStatus({ error: '文件不是有效 UTF-8，或超过 100,000 字。' }); }
                    },
                  }),
                  h('button', { type: 'submit', className: 'btn', disabled: !!status.busy || indexing?.status === 'pending' }, '导入并索引'),
                  indexing ? h('div', { role: 'status' },
                    indexing.title + ' · ' + ({ pending: '文档已提交，正在等待索引', ready: '已索引 ' + indexing.passages + ' 个片段', failed: '索引失败，草稿已保留', unknown: '尚未确认索引结果' }[indexing.status]),
                    indexing.status === 'unknown' ? h('button', { type: 'button', className: 'btn', onClick: () => setIndexing({ ...indexing, status: 'pending' }) }, '重新查看进度') : null) : null),
                h('form', { onSubmit: search },
                  h('h3', null, '检索当前库'),
                  workbenchField('搜索内容', { required: true, maxLength: 500, value: query, onChange: e => setQuery(e.target.value) }),
                  h('button', { type: 'submit', className: 'btn', disabled: !!status.busy }, '搜索'),
                  hits?.length === 0 ? h('p', null, '没有匹配的片段。') : null,
                  (hits || []).map(hit => h('div', { className: 'box', key: hit.id + ':' + hit.index },
                    h('b', null, hit.title || '原文'), h('p', null, hit.text),
                    h('button', { className: 'btn', type: 'button', disabled: !!status.busy, onClick: () => readSource(hit) }, '查看原文'))),
                  source ? h('div', { className: 'box' }, h('h3', null, source.title), source.truncated ? h('p', null, '显示原文前 20,000 字。') : null, h('p', { className: 'prose' }, source.text)) : null))
                : null) : null);
        }

        const documentEventLabels = {
          retain: '首次写入', append: '追加内容', reprocess: '重新提取', retag: '修改标签',
          fact_edited: '更正事实', fact_invalidated: '标为失效', fact_restored: '恢复事实',
          fact_deleted: '删除事实', observations_cleared: '清理观察', consolidation: '整理观察',
        };

        function MemoryHistory({ scope, memory, bankRevision }) {
          const [status, setStatus] = React.useState({});
          const active = React.useRef(null);
          const observation = (memory.fact_type || memory.type) === 'observation';
          const documentId = typeof memory.document_id === 'string' ? memory.document_id : '';
          const id = observation ? memory.id : documentId;
          React.useEffect(() => () => active.current?.abort(), [bankRevision]);
          if (!id) return null;

          async function load() {
            active.current?.abort();
            const controller = new AbortController();
            active.current = controller;
            setStatus({ loading: true });
            try {
              const op = observation ? 'observation-history' : 'document-history';
              const history = await api(op, { id, scope }, controller.signal);
              if (!controller.signal.aborted) setStatus({ items: history.items });
            } catch (error) {
              if (!controller.signal.aborted) setStatus({ error: error.message });
            }
          }

          return h('div', { className: 'section memory-history' },
            h('h3', null, observation ? '观察版本' : '来源文档历史'),
            h('button', { type: 'button', className: 'btn', disabled: !!status.loading, onClick: load },
              status.loading ? '正在读取历史…' : status.items ? '刷新历史' : '查看变化历史'),
            status.error ? h('p', { role: 'status' }, status.error) : null,
            status.items?.length === 0 ? h('p', null, '这个来源暂无历史记录。') : null,
            status.items?.length ? h('ol', null, status.items.map((item, index) => h('li', { key: index },
              h('time', { dateTime: item.date || undefined }, item.date ? formatTime(item.date) : '时间未提供'),
              observation
                ? h('div', null, item.previousText ? h('p', { className: 'prose' }, item.previousText) : null,
                  item.newSources ? h('span', null, '该次变更新增 ' + item.newSources + ' 个来源') : null)
                : h('span', null, ' · ' + (documentEventLabels[item.kind] || '其他变化') +
                  ' · 事实 +' + item.factsAdded + ' / −' + item.factsRemoved + ' · 影响观察 ' + item.observationsChanged),
            ))) : null);
        }

        function Page() {
          const [scope, setScope] = React.useState('project');
          const [tab, setTab] = React.useState('facts');
          const [q, setQ] = React.useState('');
          const [query, setQuery] = React.useState('');
          const [offset, setOffset] = React.useState(0);
          const [revision, setRevision] = React.useState(0);
          const [overview, setOverview] = React.useState({ loading: true });
          const [data, setData] = React.useState({ loading: true });
          const [selected, setSelected] = React.useState(null);
          const [detail, setDetail] = React.useState({});
          const [graph, setGraph] = React.useState(null);
          const [graphBusy, setGraphBusy] = React.useState(false);
          const [diagnostics, setDiagnostics] = React.useState({ loading: true });
          const [copied, setCopied] = React.useState(false);
          const [banks, setBanks] = React.useState([]);
          const [bank, setBank] = React.useState('');
          const [skills, setSkills] = React.useState({ loading: false });
          const [evolution, setEvolution] = React.useState(null);
          const [semantic, setSemantic] = React.useState(false);
          const graphController = React.useRef(null);

          React.useEffect(() => () => graphController.current && graphController.current.abort(), []);
          React.useEffect(() => {
            const ac = new AbortController();
            Promise.allSettled([
              api('banks', {}, ac.signal),
              companionRequest('/api/hindsight-workbench/learning?scope=banks', undefined, ac.signal),
            ]).then(([remote, local]) => {
              if (ac.signal.aborted) return;
              const value = remote.value || local.value;
              if (!value) return;
              const list = [...(remote.value?.banks || [])];
              for (const id of local.value?.banks || []) {
                if (!list.some(entry => entry.id === id)) list.push({ id });
              }
              if (value.projectBank && !list.some(entry => entry.id === value.projectBank)) list.push({ id: value.projectBank });
              setBanks(list);
              let stored = '';
              try { stored = localStorage.getItem('hbm.bank') || ''; } catch { stored = ''; }
              const active = list.find(entry => entry.id === connection.bank);
              const saved = list.find(entry => entry.id === stored);
              const configured = list.find(entry => entry.id === value?.projectBank);
              const next = (active || saved || configured)?.id || '';
              const changed = connection.bank !== next;
              connection.bank = next;
              setBank(next || value?.projectBank || '');
              if (changed) setRevision(x => x + 1);
            }, () => {});
            return () => ac.abort();
          }, [revision]);
          React.useEffect(() => {
            if (tab !== 'skills') return undefined;
            const ac = new AbortController(); setSkills({ loading: true });
            api('skills', {}, ac.signal).then(value => { if (!ac.signal.aborted) setSkills({ value }); }, e => { if (!ac.signal.aborted) setSkills({ error: e.message }); });
            return () => ac.abort();
          }, [tab, revision]);
          React.useEffect(() => {
            const ac = new AbortController();
            setDiagnostics({ loading: true });
            api('diagnostics', {}, ac.signal).then(value => { if (!ac.signal.aborted) setDiagnostics({ value }); }, e => { if (!ac.signal.aborted) setDiagnostics({ error: e.message }); });
            return () => ac.abort();
          }, [revision]);
          React.useEffect(() => {
            const ac = new AbortController(); setOverview({ loading: true });
            const target = scope === 'both' ? 'project' : scope;
            Promise.allSettled([api('status', { scope: target }, ac.signal), api('stats', { scope: target }, ac.signal)]).then(([health, stats]) => {
              if (ac.signal.aborted) return;
              setOverview({
                health: health.value,
                healthError: health.reason?.message,
                stats: stats.value,
                statsError: stats.reason?.message,
              });
            });
            return () => ac.abort();
          }, [revision, scope]);
          React.useEffect(() => {
            const ac = new AbortController();
            setData({ loading: true }); setSelected(null); setDetail({}); setGraph(null); setGraphBusy(false);
            if (graphController.current) graphController.current.abort();
            if (['setup', 'skills', 'knowledge', 'evolution', 'long-term'].includes(tab)) { setData({}); return () => ac.abort(); }
            const op = tab === 'pages' ? 'pages' : 'list';
            const args = op === 'list' ? { q: query, offset: String(offset), scope } : { scope };
            const request = semantic && op === 'list' && query
              ? companionRequest('/api/hindsight-workbench/recall', { query, scope, bank: bank || connection.bank }, ac.signal)
              : api(op, args, ac.signal);
            request.then(value => { if (!ac.signal.aborted) setData({ value }); }, e => { if (!ac.signal.aborted) setData({ error: e.message }); });
            return () => ac.abort();
          }, [tab, query, offset, revision, scope, semantic, bank]);
          React.useEffect(() => {
            if (!selected) return;
            const ac = new AbortController(); setDetail({ loading: true });
            api(selected.kind === 'page' ? 'page' : 'memory', { id: selected.id, scope: selected.scope }, ac.signal)
              .then(value => { if (!ac.signal.aborted) setDetail({ value }); }, e => { if (!ac.signal.aborted) setDetail({ error: e.message }); });
            return () => ac.abort();
          }, [selected, revision]);
          React.useEffect(() => {
            const onKey = e => { if (e.key === 'Escape' && selected) closeDetail(); };
            window.addEventListener('keydown', onKey);
            return () => window.removeEventListener('keydown', onKey);
          }, [selected]);

          const scopeText = s => s === 'global' ? label('scopeGlobal') : s === 'both' ? label('scopeBoth') : label('scopeProject');
          const itemScope = item => scope === 'both' && item._source && item._source.scope ? item._source.scope : scope === 'global' ? 'global' : 'project';
          const stats = overview.stats;
          const endpoint = (overview.health && overview.health.connection && overview.health.connection.endpoint) || '—';
          const health = overview.health?.status;
          const statusText = overview.loading ? label('loading') : health === 'healthy' ? label('connected') : (HEALTH_LABELS[health] || label('failed'));

          const choose = (item, kind, origin) => {
            if (graphController.current) graphController.current.abort();
            setGraph(null); setGraphBusy(false); setCopied(false);
            setSelected({ id: item.id || item, kind, scope: origin, title: kind === 'page' ? item.name : undefined });
            setDetail({ loading: true });
          };
          const closeDetail = () => { if (graphController.current) graphController.current.abort(); setGraph(null); setGraphBusy(false); setDetail({}); setSelected(null); };
          const draftSkillFromMemory = memory => {
            setEvolution({ id: selected.id, scopeLabel: scopeText(selected.scope), text: String(memory.text || '').slice(0, 4000) });
            closeDetail(); setTab('evolution');
          };
          const refresh = () => { if (graphController.current) graphController.current.abort(); setGraph(null); setGraphBusy(false); setRevision(x => x + 1); };
          const loadGraph = () => {
            if (!selected) return;
            if (graphController.current) graphController.current.abort();
            const ac = new AbortController(); graphController.current = ac; setGraphBusy(true); setGraph(null);
            api('graph', { scope: selected.scope }, ac.signal).then(value => { if (!ac.signal.aborted) { setGraph({ value }); setGraphBusy(false); } }, e => { if (!ac.signal.aborted) { setGraph({ error: e.message }); setGraphBusy(false); } });
          };
          const copyText = () => {
            const text = detail.value ? (selected && selected.kind === 'page' ? detail.value.body : detail.value.text) : '';
            if (!text || !navigator.clipboard) return;
            navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }, () => {});
          };

          const notice = (text, kind) => h('div', { className: 'notice' + (kind === 'error' ? ' error' : ''), role: 'status' }, text);
          const skeleton = () => h(React.Fragment, null, h('div', { className: 'skeleton' }), h('div', { className: 'skeleton' }), h('div', { className: 'skeleton' }), h('div', { className: 'skeleton' }));
          const empty = (title, hint) => h('div', { className: 'empty' }, h('div', { className: 'art' }, h(Art)), h('h2', null, title), h('p', null, hint));

          function renderCard(item, origin) {
            const id = origin + ':' + item.id;
            const active = selected && selected.id === item.id && selected.scope === origin;
            return h('button', { key: id, type: 'button', className: 'card', 'aria-current': active ? 'true' : 'false', onClick: () => choose(item, 'memory', origin) },
              h('div', { className: 'meta' },
                scope === 'both' ? h('span', { className: 'tag src' }, scopeText(origin)) : null,
                h('span', { className: 'tag type' }, typeLabel(item.fact_type || item.type)),
                h('span', null, formatTime(item.date || item.timestamp))),
              h('p', null, item.text || label('unknown')));
          }

          function skillsView() {
            if (skills.loading) return skeleton();
            if (skills.error) {
              const stale = /不支持|unsupported/i.test(skills.error);
              return h(React.Fragment, null,
                notice(stale ? label('skillsUnavailable') : skills.error, 'error'),
                h('p', { className: 'skills-note' }, label('skillsRestart')));
            }
            const items = (skills.value && skills.value.items) || [];
            if (!items.length) return empty(label('emptySkills'), label('emptySkillsHint'));
            return h('div', { className: 'skills' },
              h('p', { className: 'skills-note' }, label('skillsNote')),
              h('div', { className: 'skill-grid' }, items.map(item => h('article', { key: item.id, className: 'skill-card' },
                h('div', { className: 'skill-top' }, h('b', null, item.name || item.id), h('span', { className: 'tag type' }, label('skillTag'))),
                h('p', null, item.description || label('unknown')),
                h('code', { className: 'skill-id', title: item.id }, item.id)))));
          }

          function renderList() {
            if (data.loading) return skeleton();
            if (data.error) return h(React.Fragment, null, notice(data.error, 'error'), h('button', { className: 'btn', style: { margin: '4px 4px 0' }, onClick: refresh }, label('retry')));
            if (tab === 'pages') {
              const roots = data.value && data.value.roots || [];
              if (!roots.length) return empty(label('emptyPages'), label('emptyPages'));
              return tree(roots, 0);
            }
            const items = data.value && data.value.items || [];
            if (scope === 'both') {
              const groups = ['project', 'global'].map(s => ({ scope: s, rows: items.filter(i => itemScope(i) === s) })).filter(g => g.rows.length);
              const failed = (data.value && data.value.sources || []).filter(s => !s.ok);
              return h(React.Fragment, null,
                failed.map(s => h('div', { key: s.source.scope }, notice(s.source.label + '：' + (s.error || ''), 'error'))),
                !items.length && failed.length < 2 ? empty(label('emptyTitle'), query ? label('emptyFacts') : label('emptySearch')) : null,
                groups.map(g => h('div', { key: g.scope },
                  h('div', { className: 'list-head', style: { padding: '10px 6px 6px', border: 0 } }, h('b', null, scopeText(g.scope)), h('span', null, g.rows.length + ' ' + label('items'))),
                  g.rows.map(item => renderCard(item, itemScope(item))))));
            }
            if (!items.length) return empty(label('emptyTitle'), query ? label('emptyFacts') : label('emptySearch'));
            return items.map(item => renderCard(item, itemScope(item)));
          }

          function tree(nodes, depth) {
            const rows = [];
            (nodes || []).forEach(node => {
              if (node.kind === 'folder') {
                rows.push(h('div', { key: 'f:' + node.id, style: { padding: '10px 10px 4px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--hbm-faint)' } }, node.name));
                rows.push(...tree(node.children, depth + 1));
              } else {
                const active = selected && selected.id === node.id;
                rows.push(h('button', { key: 'p:' + node.id, type: 'button', className: 'card', 'aria-current': active ? 'true' : 'false', onClick: () => choose(node, 'page', scope) },
                  h('div', { className: 'meta' }, h('span', { className: 'tag type' }, label('pageDetail')), h('span', null, node.id)),
                  h('p', null, node.name)));
              }
            });
            return rows;
          }

          function metaChips(d) {
            const chips = [];
            if (d.fact_type || d.type) chips.push(h('span', { className: 'tag', key: 't' }, typeLabel(d.fact_type || d.type)));
            const when = d.timestamp || d.date;
            if (when) chips.push(h('span', { className: 'tag', key: 'd' }, formatTime(when)));
            (Array.isArray(d.tags) ? d.tags : []).forEach((tag, i) => chips.push(h('span', { className: 'tag', key: 'g' + i }, '#' + tag)));
            return chips.length ? h('div', { className: 'chips' }, chips) : null;
          }

          function relationsView(d) {
            const g = graph && graph.value;
            const nodes = new Map(((g && g.nodes) || []).map(n => [n.data.id, n.data]));
            const edges = ((g && g.edges) || []).map(e => e.data).filter(e => e.source === d.id || e.target === d.id);
            return h('div', { className: 'section' },
              h('h3', null, label('relations')),
              h('p', { className: 'muted', style: { marginBottom: 10 } }, label('graphHint')),
              h('button', { className: 'btn', type: 'button', onClick: loadGraph, disabled: graphBusy }, graphBusy ? label('loading') : label('loadGraph')),
              graph && graph.error ? notice(graph.error, 'error') : null,
              g ? (edges.length
                ? h('div', { style: { marginTop: 10 } }, edges.slice(0, 100).map((e, i) => {
                    const other = e.source === d.id ? e.target : e.source;
                    return h('button', { className: 'linkrow', key: i, type: 'button', onClick: () => choose({ id: other }, 'memory', selected.scope) },
                      h('span', { className: 'tag type', style: { marginRight: 8 } }, typeLabel(e.linkType || 'relation')),
                      (nodes.get(other) && nodes.get(other).text) || other);
                  }), edges.length > 100 ? notice(label('limited')) : null)
                : notice(label('noRelation'))) : null);
          }

          function detailView() {
            if (tab === 'setup') return setupView();
            if (!selected) return h('div', { className: 'empty' }, h('div', { className: 'art' }, h(Art)), h('h2', null, label('choose')), h('p', null, label('chooseHint')));
            if (detail.loading) return h('div', { style: { padding: 4 } }, skeleton());
            if (detail.error) return h(React.Fragment, null, notice(detail.error, 'error'), h('button', { className: 'btn', onClick: refresh }, label('retry')));
            const d = detail.value;
            if (!d) return empty(label('choose'), label('chooseHint'));
            const isPage = selected.kind === 'page';
            const text = isPage ? d.body : d.text;
            const suspicious = /\uFFFD|(?:Ã.|Â.|å.|æ.|ç.){3}/.test(String(text || ''));
            const keys = isPage ? null : { document_id: d.document_id, state: d.state };
            return h(React.Fragment, null,
              h('div', { className: 'detail-head' },
                h('h2', null, isPage ? (d.name || label('pageDetail')) : label('detail')),
                h('div', { className: 'acts' },
                  text ? h('button', { className: 'iconbtn', type: 'button', onClick: copyText, title: label('copy'), 'aria-label': label('copy') }, copied ? h('span', { style: { fontSize: 11, padding: '0 2px' } }, label('copied')) : h(Copy)) : null,
                  h('button', { className: 'iconbtn', type: 'button', onClick: closeDetail, title: label('close'), 'aria-label': label('close') }, h(X)))),
              h('div', { className: 'meta', style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--hbm-faint)' } },
                h('span', { className: 'tag src' }, scopeText(selected.scope)),
                h('span', { style: { overflowWrap: 'anywhere' } }, d.id || '')),
              metaChips(d),
              suspicious ? notice(label('suspect')) : null,
              h('p', { className: 'prose' }, text || label('unknown')),
              isPage ? null : (d.context ? h('div', { className: 'section' }, h('h3', null, label('context')), h('p', null, d.context)) : null),
              !isPage && Array.isArray(d.entities) && d.entities.length ? h('div', { className: 'section' }, h('h3', null, label('entities')), h('div', { className: 'pill-list' }, d.entities.map((e, i) => h('span', { className: 'tag', key: i }, typeof e === 'string' ? e : (e.name || e.id || JSON.stringify(e)))))) : null,
              !isPage && Array.isArray(d.source_memories) && d.source_memories.length ? h('div', { className: 'section' }, h('h3', null, label('source')), d.source_memories.map(s => h('button', { className: 'linkrow', key: s.id, type: 'button', onClick: () => choose({ id: s.id }, 'memory', selected.scope) }, s.text || s.id))) : null,
              !isPage && (d.metadata || d.document_id || d.state) ? h('div', { className: 'section' }, h('h3', null, label('metadata')), h('dl', { className: 'kv' }, Object.keys(keys).filter(k => keys[k] != null).map(k => h(React.Fragment, { key: k }, h('dt', null, k), h('dd', null, String(keys[k])))), d.metadata ? h(React.Fragment, null, h('dt', null, 'metadata'), h('dd', null, JSON.stringify(d.metadata, null, 2))) : null)) : null,
              !isPage && typeof d.text === 'string' && d.text.trim() ? h('div', { className: 'section' },
                h('button', { type: 'button', className: 'btn', onClick: () => draftSkillFromMemory(d) }, '提炼为 Skill 草稿')) : null,
              !isPage ? h(MemoryHistory, { key: selected.scope + ':' + selected.id + ':' + revision, scope: selected.scope, memory: { ...d, id: selected.id }, bankRevision: revision }) : null,
              !isPage ? relationsView(d) : null);
          }

          function setupView() {
            const d = diagnostics.value;
            const list = d && d.banks || [];
            return h('div', { className: 'setup' },
              h('h2', { style: { margin: '0 0 6px', fontSize: 18 } }, label('setupTitle')),
              h('p', null, label('setupHint')),
              diagnostics.loading ? notice(label('loading')) : diagnostics.error ? notice(diagnostics.error, 'error') : h(React.Fragment, null,
                h('h3', null, label('localService')),
                h('div', { className: 'box' }, d.endpoint, ' · ', d.health?.ok ? (HEALTH_LABELS[d.health.status] || '已响应') : '不可用',
                  d.health?.error ? h('div', null, d.health.error) : null),
                h('h3', null, label('banks')),
                list.map(b => h('div', { className: 'box', key: b.source.scope }, h('b', null, b.source.label + ' · ' + b.source.bank), h('div', null, b.ok ? '已存在 · ' + (b.data.total_nodes == null ? '—' : b.data.total_nodes) + ' 条事实' : (b.error || '不可用')))),
                h('h3', null, label('upstream')),
                h('div', { className: 'box' }, d.upstream && d.upstream.available ? ('已安装：' + (d.upstream.installed ? '是' : '否') + ' · 版本：' + (d.upstream.version || '未知') + ' · 挂载数：' + ((d.upstream.entries || []).length)) : (d.upstream && d.upstream.error || '不可用')),
                (d.upstream && d.upstream.entries || []).map((e, i) => h('p', { key: i, style: { margin: '4px 0' } }, '挂载 ' + (i + 1) + '：' + (e.enabled ? '启用' : '停用') + ' / ' + (e.phase || '状态未知'))),
                d.upstream?.duplicate ? notice('发现多个上游挂载。请先在官方插件管理器核查，避免重复采集。')
                  : d.upstream?.available && !d.upstream.entries?.some(entry => entry.enabled && entry.phase === 'active')
                    ? notice('尚未确认采集器已运行。如需自动采集，请在 DSH 插件管理中查看启用与加载状态。')
                    : null),
              h('h3', null, label('guide')),
              h('ol', null, SETUP_STEPS.map((step, i) => h('li', { key: i, style: { margin: '6px 0' } }, step))),
              h('h3', null, label('boundary')),
              h('p', null, '工作台支持按库浏览与标明来源的联合搜索，不代表上游已实现双库自动召回注入；自动采集仍由已安装的 Hindsight 集成负责，本插件不重复采集。'),
              h('h3', null, label('encoding')),
              h('p', null, '响应按严格 UTF-8 解码；疑似乱码只提示，不自动转码、不改写原文。本版本只读。'));
          }

          const shown = tab === 'facts' && scope === 'both'
            ? ((data.value && data.value.items || []).length + ' ' + label('items'))
            : tab === 'pages'
              ? ((data.value && data.value.roots || []).length + ' ' + label('items'))
              : (data.value && data.value.total != null ? data.value.total : (data.value && data.value.items || []).length) + ' ' + label('items');
          const canNext = scope === 'both'
            ? !!((data.value && data.value.sources || []).some(s => s.ok && offset + 30 < (s.total || 0)))
            : !!(data.value && data.value.total != null && offset + 30 < data.value.total);

          return h('section', { className: 'hbm', 'aria-label': label('title') },
            h('style', null, css),
            h('div', { className: 'shell' },
              h('header', { className: 'top' },
                h('div', { className: 'brand' }, h('div', { className: 'logo' }, h(Icon, { size: 24 })),
                  h('div', null, h('h1', null, label('title')), h('p', null, label('subtitle')))),
                h('div', { className: 'top-right' },
                  h('span', { className: 'chip' + (overview.loading ? '' : health === 'healthy' ? ' ok' : ' bad'), title: endpoint }, h('i'), statusText),
                  h('button', { className: 'btn', type: 'button', onClick: refresh }, label('refresh')),
                  h('button', { className: 'btn primary', type: 'button', onClick: () => ctx.layout.selectPanel(null) }, label('back')))),
              h('div', { className: 'hero' },
                h('div', { className: 'hero-main' },
                  h('span', { className: 'eyebrow' }, label('all') + ' · ' + label('readOnly')),
                  h('div', { className: 'bank-row' },
                    h('label', { className: 'bank-label', htmlFor: 'hbm-bank' }, label('bankLabel')),
                    h('select', {
                      id: 'hbm-bank', className: 'bank-select', value: bank || '—',
                      onChange: e => {
                        const next = e.target.value;
                        connection.bank = next; setBank(next);
                        try { localStorage.setItem('hbm.bank', next); } catch { /* ignore */ }
                        setSelected(null); setDetail({}); setOffset(0); setRevision(x => x + 1);
                      },
                      disabled: !banks.length,
                    }, !banks.some(entry => entry.id === bank) ? h('option', { value: bank || '—', disabled: true }, '选择项目记忆库') : null,
                    banks.map(entry => h('option', { key: entry.id, value: entry.id }, entry.id))),
                    h('span', { className: 'bank-count' }, banks.length ? (banks.length > 1 ? banks.length + ' 个记忆库' : label('readOnly')) : label('bankOffline'))),
                  h('div', { className: 'scopes', role: 'tablist' },
                    [['project', label('scopeProject')], ['global', label('scopeGlobal')], ['both', label('scopeBoth')]].map(([s, text]) =>
                      h('button', { key: s, type: 'button', 'aria-pressed': scope === s ? 'true' : 'false', onClick: () => { closeDetail(); setScope(s); setOffset(0); if (s === 'both' && tab === 'pages') setTab('facts'); } }, text)))),
                h('div', { className: 'metrics' },
                  [['total_nodes', label('total'), false], ['total_links', label('links'), false], ['total_documents', label('docs'), false], ['pending_operations', label('pending'), true]].map(([key, text, hot]) =>
                    h('div', { key, className: 'metric' + (hot && stats && stats[key] > 0 ? ' hot' : '') }, h('b', null, stats && stats[key] != null ? stats[key] : '—'), h('span', null, text))))),
              overview.healthError ? h(React.Fragment, null, notice(overview.healthError, 'error'), h('p', { className: 'skills-note' }, label('serviceHint'))) : null,
              overview.statsError && health ? notice('所选记忆库：' + overview.statsError, 'error') : null,
              h('div', { className: 'toolbar' },
                h('div', { className: 'tablist', role: 'tablist' },
                  [['facts', label('tabFacts')], ['long-term', '长期记忆'], ['pages', label('tabPages')], ['knowledge', label('tabKnowledge')], ['skills', label('tabSkills')], ['evolution', label('tabEvolution')], ['setup', label('tabSetup')]].map(([key, text]) =>
                    h('button', { key, type: 'button', role: 'tab', 'aria-selected': tab === key ? 'true' : 'false', onClick: () => { closeDetail(); if (key === 'pages' && scope === 'both') setScope('project'); setTab(key); setOffset(0); } }, text))),
                tab === 'facts' ? h('form', { className: 'search', onSubmit: e => { e.preventDefault(); setOffset(0); setQuery(q.trim()); } },
                  h('span', { className: 'mag' }, h(Mag)),
                  h('input', { value: q, maxLength: 500, onChange: e => setQ(e.target.value), placeholder: label('searchHint'), 'aria-label': label('searchHint') }),
                  q ? h('button', { className: 'clr', type: 'button', 'aria-label': label('clear'), onClick: () => { setQ(''); setQuery(''); setOffset(0); } }, h(X, { size: 13 })) : null) : null,
                tab === 'facts' ? h('label', { className: 'hint' },
                  h('input', { type: 'checkbox', checked: semantic, onChange: event => { closeDetail(); setOffset(0); setSemantic(event.target.checked); } }),
                  '按含义召回') : null,
                ['setup', 'knowledge', 'evolution', 'long-term'].includes(tab) ? null : h('span', { className: 'hint' }, tab === 'skills' ? (skills.error ? '—' : ((skills.value && skills.value.total) || 0) + ' ' + label('items')) : (query ? '“' + query + '” · ' + shown : shown))),
              tab === 'setup' ? h('div', { className: 'content' }, h('div', { className: 'detail-pane', style: { width: '100%' } }, h('div', { className: 'detail-scroll' }, setupView())))
                : tab === 'skills' ? h('div', { className: 'content' }, h('div', { className: 'detail-pane', style: { width: '100%' } }, h('div', { className: 'detail-scroll' }, h(SkillCreator, { onCreated: refresh }), skillsView())))
                : tab === 'knowledge' ? h('div', { className: 'content' }, h('div', { className: 'detail-pane', style: { width: '100%' } }, h('div', { className: 'detail-scroll' }, h(KnowledgeWorkspace))))
                : tab === 'long-term' ? h('div', { className: 'content' }, h('div', { className: 'detail-pane', style: { width: '100%' } }, h('div', { className: 'detail-scroll' },
                    scope === 'both' ? h('p', { className: 'skills-note' }, '请选择项目库或全局库，查看对应的长期记忆。')
                      : h(LongTermNotes, { key: scope + ':' + bank, bank, scope }))))
                : tab === 'evolution' ? h('div', { className: 'content' }, h('div', { className: 'detail-pane', style: { width: '100%' } }, h('div', { className: 'detail-scroll' },
                    h(EvolutionWorkspace, { key: scope + bank, evidence: evolution, bank, scope, onDiscard: () => setEvolution(null),
                      onCreated: () => { setEvolution(null); setTab('skills'); refresh(); } }))))
                : h('div', { className: 'content' + (selected ? ' show-detail' : '') },
                    h('aside', { className: 'list-pane', 'aria-busy': !!data.loading },
                      h('div', { className: 'list-head' }, h('b', null, shown), scope === 'both' ? h('span', null, label('scopeBoth')) : null, h('span', { className: 'spacer' }),
                        data.loading ? h('span', null, label('loading')) : null),
                      h('div', { className: 'list-scroll' }, renderList()),
                      tab === 'facts' && !(semantic && query) ? h('div', { className: 'pager' },
                        h('button', { type: 'button', onClick: () => setOffset(x => Math.max(0, x - 30)), disabled: offset === 0 || data.loading }, h(Arrow, { dir: 'left' }), label('prev')),
                        h('span', { className: 'spacer' }),
                        h('span', null, data.loading ? '—' : scope === 'both' ? label('page') + ' ' + (Math.floor(offset / 30) + 1) + ' 页' : data.value?.items?.length ? (offset + 1) + '–' + (offset + data.value.items.length) : '0'),
                        h('span', { className: 'spacer' }),
                        h('button', { type: 'button', onClick: () => setOffset(x => x + 30), disabled: data.loading || !canNext }, label('next'), h(Arrow))) : null),
                    h('section', { className: 'detail-pane', 'aria-label': label('detail') }, h('div', { className: 'detail-scroll' }, detailView())))),
              h('div', { className: 'foot' }, h('span', null, label('endpoint') + ' ' + endpoint)));
        }

        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: ID, locale: NS }, Page));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: ID, label: () => label('title'), locale: NS, order: 65 }, ({ size }) => h(Icon, { size: size || 20 })));
        ctx.effect(() => () => { if (ctx.layout.panelInfo.getSnapshot().activePanelId === ID) ctx.layout.selectPanel(null); });
        // Temporary probe: open the workbench once on load so layout and data can be verified headlessly.
        if (typeof location !== 'undefined' && /[#&]hbm-probe(?:$|[&])/.test(location.hash)) setTimeout(() => { try { ctx.layout.selectPanel(ID); } catch (error) { console.error('[hbm] probe open failed', error); } }, 600);
        if (typeof window !== 'undefined' && window.addEventListener) {
          const onKey = event => {
            if (!event.altKey || !event.shiftKey || (event.key !== 'H' && event.key !== 'h')) return;
            event.preventDefault();
            try { ctx.layout.selectPanel(ID); } catch (error) { console.error('[hbm] hotkey open failed', error); }
          };
          window.addEventListener('keydown', onKey);
          ctx.effect(() => () => window.removeEventListener('keydown', onKey));
        }
      },
    };
  },
});
