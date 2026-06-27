// ==========================================
// 川上 v1.0 — 双模块布局
// 模块一：Top 3 当前待办（便利贴）
// 模块二：沉淀瀑布流（双列 Masonry）
// ==========================================
const { useState, useEffect, useRef, useMemo } = React;
const { Top3Focus, Omnibox, CardDetail, MasonryCard, CalendarHeatmap, PostEditor, callAI, parseTime, localParse, matchObj, load, save, storageAvailable, loadFromSB, saveEventToSB, deleteEventFromSB, saveObjToSB, deleteObjFromSB, uid, fmtTime, fmtDate, tsDay, todayStr, OBJ_PALETTE, TYPE_LABELS, EV_KEY, OBJ_KEY, MOCK_OBJS, MOCK_EVENTS, Ic } = window.Kawa;

const App = () => {
  // ── 数据层（与现有 app.js 完全相同）──
  if (window.location.search.includes('reset') && storageAvailable()) {
    localStorage.removeItem(EV_KEY);
    localStorage.removeItem(OBJ_KEY);
    console.log('localStorage cleared');
  }

  const [events, setEvents] = useState(() => { const d = load(EV_KEY); return (d && d.length) ? d : MOCK_EVENTS; });
  const [objectives, setObjectives] = useState(() => { const d = load(OBJ_KEY); return (d && d.length) ? d : MOCK_OBJS; });
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [storageWarn, setStorageWarn] = useState(false);
  const [activeTag, setActiveTag] = useState(null);   // Tag 筛选
  const [selectedDate, setSelectedDate] = useState(null); // 热力图日期筛选
  const [selectedCard, setSelectedCard] = useState(null);  // 详情浮层
  const [editorOpen, setEditorOpen] = useState(false);     // 发布编辑器

  // 瀑布流布局状态
  const [masonryColumns, setMasonryColumns] = useState(2);
  useEffect(() => {
    const update = () => setMasonryColumns(window.innerWidth >= 640 ? 2 : 2);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => { if (!storageAvailable()) setStorageWarn(true); }, []);

  // Supabase 加载
  useEffect(() => {
    (async () => {
      const remote = await loadFromSB();
      if (remote) {
        if (remote.events.length > 0) { setEvents(remote.events); save(EV_KEY, remote.events); }
        if (remote.objectives.length > 0) { setObjectives(remote.objectives); save(OBJ_KEY, remote.objectives); }
      }
    })();
  }, []);

  // localStorage 同步
  useEffect(() => { const ok = save(EV_KEY, events); if (!ok && events.length > 0) setStorageWarn(true); }, [events]);
  useEffect(() => { const ok = save(OBJ_KEY, objectives); if (!ok && objectives.length > 0) setStorageWarn(true); }, [objectives]);

  const toast_ = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── v1.0 selectors ──

  // 模块一：Top 3 待办（type=todo, status=pending, 按 timeline_time ASC 取前3）
  const top3Todos = useMemo(() =>
    events
      .filter(e => e.type === 'todo' && e.status !== 'done')
      .sort((a, b) => new Date(a.timeline_time) - new Date(b.timeline_time))
      .slice(0, 3)
  , [events]);

  // Tag 列表 = objectives + "全部"
  const tagList = useMemo(() => {
    const base = [{ id: null, title: '全部', color: '#8B84A0' }];
    return [...base, ...objectives];
  }, [objectives]);

  // 模块二：瀑布流全部卡片（置顶优先 → record_time 倒序）
  const allCards = useMemo(() => {
    const cards = events
      .map(e => ({ ...e, isCompleted: e.status === 'done' }))
      .sort((a, b) => {
        const aPinned = a.ai_metadata?.pinned_at ? 1 : 0;
        const bPinned = b.ai_metadata?.pinned_at ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;  // 置顶优先
        return new Date(bPinned ? b.ai_metadata.pinned_at : b.record_time) - new Date(aPinned ? a.ai_metadata.pinned_at : a.record_time);
      });
    let filtered = cards;
    if (activeTag) filtered = filtered.filter(e => e.objective_id === activeTag);
    if (selectedDate) filtered = filtered.filter(e => tsDay(new Date(e.record_time)) === selectedDate);
    return filtered;
  }, [events, activeTag]);

  // ── Actions（复用现有逻辑）──

  const handleSubmit = async text => {
    if (/^\/目标[：:]\s*(.+)/.test(text) || /^\/obj[：:]\s*(.+)/i.test(text)) {
      const m = text.match(/^(?:\/目标|\/obj)[：:]\s*(.+)/);
      const title = m[1].trim();
      const newObj = { id: uid(), title, target: 100, current: 0, color: OBJ_PALETTE[Math.floor(Math.random() * OBJ_PALETTE.length)] };
      setObjectives(prev => [...prev, newObj]);
      saveObjToSB(newObj);
      toast_('目标「' + title + '」已创建'); return;
    }

    setProcessing(true);
    try {
      const { result: aiRes, aiPending } = await callAI(text, objectives);
      const aiFallback = !!aiPending;

      if (aiRes.type === 'objective') {
        const aiObj = { id: uid(), title: aiRes.ai_metadata.title, target: 100, current: 0, color: aiRes.ai_metadata.color || OBJ_PALETTE[Math.floor(Math.random() * OBJ_PALETTE.length)] };
        setObjectives(prev => [...prev, aiObj]);
        saveObjToSB(aiObj);
        toast_('AI 创建目标「' + aiRes.ai_metadata.title + '」'); setProcessing(false); return;
      }
      let tl = aiRes.timeline_time ? new Date(aiRes.timeline_time) : null;
      if (!tl || isNaN(tl.getTime())) tl = parseTime(text);
      const oid = aiRes.objective_id || matchObj(text, objectives);
      const isKeyNode = aiRes.is_key_node || false;
      const evId = uid();
      const ev = { id: evId, timeline_time: tl.toISOString(), record_time: new Date().toISOString(), raw_content: text, type: aiRes.type || 'note', status: 'pending', objective_id: oid || undefined, is_key_node: isKeyNode, ai_metadata: aiRes.ai_metadata || {} };
      setEvents(prev => [ev, ...prev]);
      setProcessing(false);

      const on = objectives.find(o => o.id === oid);
      toast_(TYPE_LABELS[ev.type] + ' · ' + fmtDate(tl) + ' ' + fmtTime(tl) + (on ? ' → ' + on.title : '') + (aiFallback ? ' [本地解析]' : ''));
      saveEventToSB(ev);

      if (aiPending) {
        aiPending.then(lateAi => {
          if (!lateAi || lateAi.type === 'objective') return;
          setEvents(prev => prev.map(e => {
            if (e.id !== evId) return e;
            const lateTl = lateAi.timeline_time ? new Date(lateAi.timeline_time) : tl;
            const lateOid = lateAi.objective_id || matchObj(text, objectives);
            return { ...e, type: lateAi.type || e.type, ai_metadata: { ...e.ai_metadata, ...(lateAi.ai_metadata || {}) }, timeline_time: (lateTl && !isNaN(lateTl.getTime())) ? lateTl.toISOString() : e.timeline_time, objective_id: lateOid || e.objective_id, is_key_node: lateAi.is_key_node || e.is_key_node };
          }));
          setEvents(prev => { const updated = prev.find(e => e.id === evId); if (updated) saveEventToSB(updated); return prev; });
        });
      }
    } catch (e) { toast_('⚠ ' + (e.message || '出错')); }
    finally { setProcessing(false); }
  };

  const confirmEvent = id => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, status: 'done' } : e);
      const ev = updated.find(e => e.id === id);
      if (ev) saveEventToSB(ev);
      return updated;
    });
    toast_('✓ 已完成');
  };

  // 图片上传回调（Omnibox 快速发图）
  const handleImageSubmit = (imageUrl, caption) => {
    const ev = {
      id: uid(), timeline_time: new Date().toISOString(), record_time: new Date().toISOString(),
      raw_content: caption || '[图片]', type: 'note', status: 'pending',
      ai_metadata: { task_title: caption ? (caption.length > 12 ? caption.substring(0, 11) + '…' : caption) : '图片记录', progress_delta: 0 },
      image_url: imageUrl
    };
    setEvents(prev => [ev, ...prev]);
    saveEventToSB(ev);
    toast_('图片已上传');
  };

  // PostEditor 发布回调
  const handlePublish = (ev) => {
    setEvents(prev => [ev, ...prev]);
    saveEventToSB(ev);
    toast_('笔记已发布');
  };

  // ── 卡片详情操作 ──
  const handleCardSave = (id, data) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...data } : e);
      const ev = updated.find(e => e.id === id);
      if (ev) saveEventToSB(ev);
      return updated;
    });
    setSelectedCard(prev => prev?.id === id ? { ...prev, ...data } : prev);
    toast_('已保存');
  };

  const handleCardDelete = (id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    deleteEventFromSB(id);
    toast_('已删除');
  };

  // ── 相对时间 ──
  const relativeTime = (isoStr) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + '分钟前';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + '小时前';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + '天前';
    return fmtDate(new Date(isoStr));
  };

  // ── 瀑布流 Masonry 分配 ──
  const masonryBins = useMemo(() => {
    const cols = 2;
    const bins = Array.from({ length: cols }, () => []);
    const heights = Array(cols).fill(0);

    allCards.forEach(card => {
      const isTodo = card.type === 'todo';
      const title = card.ai_metadata?.task_title || card.raw_content || '';
      const body = card.raw_content || '';
      const hasImg = !!card.image_url;
      const hasBody = !isTodo && body && body !== title;

      let est = 0;
      if (isTodo) {
        // 紧凑便利贴：标题 1-2 行 + padding + 底部
        est = 44 + Math.ceil(title.length / 18) * 16;
      } else {
        // 笔记文章卡：padding + 大标题 + 正文 + 底部
        if (hasImg) est += 160;
        est += 56; // padding + title
        if (hasBody) est += Math.min(body.length / 15, 5) * 20;
        est += 28; // footer
      }

      let minIdx = 0;
      for (let j = 1; j < cols; j++) {
        if (heights[j] < heights[minIdx]) minIdx = j;
      }
      bins[minIdx].push(card);
      heights[minIdx] += est;
    });

    return bins;
  }, [allCards]);

  // ── 渲染 ──
  return (
    <div className="relative h-full w-full flex flex-col">
      <div className="absolute inset-0 beige-bg z-0"></div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[80] animate-in pointer-events-none">
          <div className="px-5 py-2.5 text-xs font-light tracking-wide rounded-xl"
            style={{ color: 'var(--text-primary)', background: '#fff', border: 'var(--border-card)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            {toast}
          </div>
        </div>
      )}

      {/* 卡片详情浮层 */}
      {selectedCard && (
        <CardDetail
          card={selectedCard}
          objectives={objectives}
          onClose={() => setSelectedCard(null)}
          onSave={handleCardSave}
          onDelete={handleCardDelete}
        />
      )}

      {/* 发布编辑器 */}
      {editorOpen && (
        <PostEditor
          objectives={objectives}
          onPublish={handlePublish}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {/* FAB — 快速创建 */}
      {!editorOpen && (
        <button onClick={() => setEditorOpen(true)}
          className="fixed z-60 flex items-center justify-center shadow-lg transition-transform active:scale-90"
          style={{
            right: 20, bottom: 110,
            width: 50, height: 50, borderRadius: '50%',
            background: 'var(--accent-400)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 24,
          }}>
          +
        </button>
      )}

      {/* Storage warning */}
      {storageWarn && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] animate-in" style={{ maxWidth: '90vw' }}>
          <div className="px-5 py-2.5 text-xs font-light tracking-wide rounded-xl text-center"
            style={{ color: 'var(--color-error)', background: '#fff', border: '1px solid rgba(196,128,128,0.3)' }}>
            Safari 隐私设置阻止了本地存储。<br/>数据仅保存在 Supabase 云端。
          </div>
        </div>
      )}

      {/* ───── 主内容区 ───── */}
      <div className="flex-1 overflow-y-auto no-scrollbar flow-scroll relative z-10">

        {/* Header */}
        <div className="px-5 pt-6 pb-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>川上</h1>
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(184,181,224,0.12)', color: 'var(--accent-500)' }}>
              v1.0
            </span>
          </div>
        </div>

        {/* 日历热力图 */}
        <CalendarHeatmap events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        {/* ══ 模块一：Top 3 待办 ══ */}
        <div className="mb-6">
          <div className="px-5 mb-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-error)' }}></div>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>
              当前待办 · {top3Todos.length}/3
            </h2>
          </div>
          <Top3Focus todos={top3Todos} objectives={objectives} onComplete={confirmEvent} />
        </div>

        {/* ══ Tag 导航栏 ══ */}
        <div className="overflow-x-auto no-scrollbar px-5 mb-4">
          <div className="flex gap-2 py-1">
            {tagList.map(tag => (
              <button key={tag.id || 'all'} onClick={() => setActiveTag(tag.id)}
                className="flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-all duration-200"
                style={{
                  backgroundColor: activeTag === tag.id ? (tag.color + '20') : 'transparent',
                  color: activeTag === tag.id ? tag.color : 'var(--text-tertiary)',
                  border: activeTag === tag.id ? `1px solid ${tag.color}40` : '1px solid transparent',
                }}>
                {tag.title}
              </button>
            ))}
          </div>
        </div>

        {/* ══ 模块二：沉淀瀑布流 ══ */}
        <div className="px-3">
          <div className="px-2 mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-400)' }}></div>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>
              沉淀 · {allCards.length} 条记录
            </h2>
          </div>

          <div className="flex gap-3">
            {masonryBins.map((col, ci) => (
              <div key={ci} className="flex-1 flex flex-col gap-3">
                {col.map(card => (
                  <MasonryCard key={card.id} card={card} objectives={objectives} relativeTime={relativeTime} onOpen={setSelectedCard} />
                ))}
              </div>
            ))}
          </div>

          {/* 空状态 */}
          {allCards.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>还没有记录</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>在下方输入框开始书写</p>
            </div>
          )}

          {/* 底部留白，避免被 FAB / Omnibox 遮挡 */}
          <div className="h-32"></div>
        </div>
      </div>

      {/* Omnibox（底部输入栏，复用现有组件） */}
      <div className="relative z-20 flex-shrink-0">
        <Omnibox onSubmitText={handleSubmit} isProcessing={processing} onChatOpen={() => {}} onImageSubmit={handleImageSubmit} />
      </div>
    </div>
  );
};

// ==========================================
// 挂载
// ==========================================
ReactDOM.render(React.createElement(App), document.getElementById('root'));
