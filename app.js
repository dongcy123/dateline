// ==========================================
// 川上 App — 主组件
// ==========================================
const { useState, useEffect, useRef, useMemo } = React;
const { HUD, EventCard, ObjEditor, Omnibox, ChatOverlay, chatSessions, saveChatSession, getChatMessages, callAI, parseTime, localParse, matchObj, load, save, storageAvailable, loadFromSB, saveEventToSB, deleteEventFromSB, saveObjToSB, deleteObjFromSB, uid, fmtTime, fmtDate, tsDay, todayStr, OBJ_PALETTE, TYPE_LABELS, EV_KEY, OBJ_KEY, MOCK_OBJS, MOCK_EVENTS } = window.Kawa;

const App = () => {
  // 支持 ?reset 参数强制清除旧数据
  if (window.location.search.includes('reset') && storageAvailable()) {
    localStorage.removeItem(EV_KEY);
    localStorage.removeItem(OBJ_KEY);
    console.log('localStorage cleared');
  }

  const [events, setEvents] = useState(() => { const d = load(EV_KEY); return (d && d.length) ? d : MOCK_EVENTS; });
  const [objectives, setObjectives] = useState(() => { const d = load(OBJ_KEY); return (d && d.length) ? d : MOCK_OBJS; });
  const [hudOpen, setHudOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [toast, setToast] = useState(null);
  const [objEditor, setObjEditor] = useState(null);
  const [storageWarn, setStorageWarn] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const feedRef = useRef(null); const nowRef = useRef(null);

  useEffect(() => { if (!storageAvailable()) setStorageWarn(true); }, []);

  // 从 Supabase 加载
  useEffect(() => {
    (async () => {
      const remote = await loadFromSB();
      if (remote) {
        if (remote.events.length > 0) { setEvents(remote.events); save(EV_KEY, remote.events); }
        if (remote.objectives.length > 0) { setObjectives(remote.objectives); save(OBJ_KEY, remote.objectives); }
      }
    })();
  }, []);

  useEffect(() => { const ok = save(EV_KEY, events); if (!ok && events.length > 0) setStorageWarn(true); }, [events]);
  useEffect(() => { const ok = save(OBJ_KEY, objectives); if (!ok && objectives.length > 0) setStorageWarn(true); }, [objectives]);
  useEffect(() => { nowRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' }); }, []);

  const toast_ = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const now = new Date();
  const nowIso = now.toISOString();

  const todayTodos = useMemo(() => {
    const ts = todayStr();
    const todayEs = events.filter(e => e.type === 'todo' && e.timeline_time.startsWith(ts));
    return { done: todayEs.filter(e => e.status === 'done').length, total: todayEs.length };
  }, [events]);

  const filtered = useMemo(() => {
    let es = [...events].sort((a, b) => new Date(b.timeline_time) - new Date(a.timeline_time));
    if (activeFilter) es = es.filter(e => e.objective_id === activeFilter);
    if (selectedDate) es = es.filter(e => tsDay(new Date(e.timeline_time)) === selectedDate);
    return es;
  }, [events, activeFilter, selectedDate]);

  const future = filtered.filter(e => e.timeline_time > nowIso);
  const past = filtered.filter(e => e.timeline_time <= nowIso);

  const handleSubmit = async text => { console.log('[handleSubmit] called, processing=' + processing + ' text=' + (text||'').substring(0,30));
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
      let aiRes; let aiFailed = false; try { aiRes = await callAI(text, objectives); } catch (e) { aiRes = localParse(text); aiFailed = true; }
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
      const ev = { id: uid(), timeline_time: tl.toISOString(), record_time: new Date().toISOString(), raw_content: text, type: aiRes.type || 'note', status: 'pending', objective_id: oid || undefined, is_key_node: isKeyNode, ai_metadata: aiRes.ai_metadata || {} };
      setEvents(prev => [ev, ...prev]);
      setProcessing(false);
      if (oid && isKeyNode && (aiRes.ai_metadata?.progress_delta || 0) > 0) {
        setObjectives(prev => {
          const updated = prev.map(o => o.id === oid ? { ...o, current: o.current + (aiRes.ai_metadata.progress_delta || 0) } : o);
          const obj = updated.find(o => o.id === oid);
          if (obj) saveObjToSB(obj);
          return updated;
        });
      }
      const on = objectives.find(o => o.id === oid);
      toast_(TYPE_LABELS[ev.type] + ' · ' + fmtDate(tl) + ' ' + fmtTime(tl) + (on ? ' → ' + on.title : '') + (aiFailed ? ' [本地解析]' : ''));
      saveEventToSB(ev).then(ok => { if (!ok) toast_('⚠ 未同步到云端'); });
    } catch (e) { toast_('⚠ ' + (e.message || '出错')); }
    finally { setProcessing(false); setTimeout(() => nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }
  };

  const handleChatEvents = (extractedEvents) => {
    const nowIso = new Date().toISOString();
    const newEvents = extractedEvents.map(e => ({
      id: uid(),
      timeline_time: e.timeline_time || nowIso,
      record_time: nowIso,
      raw_content: e.raw_content || '',
      type: e.type || 'note',
      status: 'pending',
      objective_id: e.objective_id || undefined,
      is_key_node: e.is_key_node || false,
      ai_metadata: e.ai_metadata || {},
      image_url: e.image_url || null,
    }));
    setEvents(prev => [...newEvents, ...prev]);
    // 批量保存到 Supabase
    newEvents.forEach(ev => { saveEventToSB(ev); });
    // 如果有关键节点，更新目标进度
    newEvents.forEach(ev => {
      if (ev.objective_id && ev.is_key_node && (ev.ai_metadata?.progress_delta || 0) > 0) {
        setObjectives(prev => {
          const updated = prev.map(o => o.id === ev.objective_id ? { ...o, current: o.current + (ev.ai_metadata.progress_delta || 0) } : o);
          const obj = updated.find(o => o.id === ev.objective_id);
          if (obj) saveObjToSB(obj);
          return updated;
        });
      }
    });
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

  const updateEvent = (id, data) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...data } : e);
      const ev = updated.find(e => e.id === id);
      if (ev) saveEventToSB(ev);
      if (ev && ev.is_key_node && ev.objective_id) {
        const oid = ev.objective_id;
        const knTotal = updated.filter(e => e.objective_id === oid && e.is_key_node).reduce((sum, e) => sum + (e.ai_metadata?.progress_delta || 0), 0);
        setObjectives(prev2 => {
          const objUpdated = prev2.map(o => o.id === oid ? { ...o, current: Math.min(knTotal, o.target) } : o);
          const obj = objUpdated.find(o => o.id === oid);
          if (obj) saveObjToSB(obj);
          return objUpdated;
        });
      }
      return updated;
    });
  };

  const deleteEvent = id => {
    setEvents(prev => {
      const ev = prev.find(e => e.id === id);
      const updated = prev.filter(e => e.id !== id);
      if (ev?.is_key_node && ev?.objective_id) {
        const oid = ev.objective_id;
        const knTotal = updated.filter(e => e.objective_id === oid && e.is_key_node).reduce((sum, e) => sum + (e.ai_metadata?.progress_delta || 0), 0);
        setObjectives(prev2 => {
          const objUpdated = prev2.map(o => o.id === oid ? { ...o, current: Math.min(knTotal, o.target) } : o);
          const obj = objUpdated.find(o => o.id === oid);
          if (obj) saveObjToSB(obj);
          return objUpdated;
        });
      }
      return updated;
    });
    deleteEventFromSB(id);
    toast_('已删除');
  };

  const deleteObj = id => {
    setObjectives(prev => prev.filter(o => o.id !== id));
    setEvents(prev => prev.map(e => e.objective_id === id ? { ...e, objective_id: undefined } : e));
    deleteObjFromSB(id);
    setActiveFilter(f => f === id ? null : f);
    toast_('目标已删除');
  };

  const saveObj = data => {
    const newObj = objEditor === true ? { id: uid(), ...data } : { ...objEditor, ...data };
    if (objEditor === true) {
      setObjectives(prev => [...prev, newObj]);
      toast_('目标已创建');
    } else {
      setObjectives(prev => prev.map(o => o.id === objEditor.id ? { ...o, ...data } : o));
      toast_('目标已更新');
    }
    saveObjToSB(newObj);
    setObjEditor(null);
  };

  const renderTL = list => {
    let lastDate = null;
    return list.map(ev => {
      const d = new Date(ev.timeline_time); const ds = tsDay(d); const showDiv = lastDate !== ds; lastDate = ds;
      return <React.Fragment key={ev.id}>
        {showDiv && <div id={'date-' + ds} className="flex items-center gap-3 py-8 first:pt-0"><div className="flex-1 h-px" style={{ backgroundColor: 'rgba(184,181,224,0.15)' }}></div><span className="text-[10px] font-light tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{ds}</span><div className="flex-1 h-px" style={{ backgroundColor: 'rgba(184,181,224,0.15)' }}></div></div>}
        <EventCard event={ev} objectives={objectives} onConfirm={confirmEvent} onUpdate={updateEvent} onDelete={deleteEvent} />
      </React.Fragment>;
    });
  };

  const EmptyWelcome = () => (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-72 p-6 text-center space-y-3" style={{ background: '#fff', border: 'var(--border-card)', borderRadius: '16px' }}>
        <div className="w-2 h-2 rounded-full mx-auto" style={{ backgroundColor: 'var(--accent-300)' }}></div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>时间轴为空</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>在下方输入框记录第一个事件<br/>或点击 💬 开启 AI 对话</p>
      </div>
    </div>
  );

  // 回到此时 — 浮动按钮
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const onScroll = () => {
      const nowEl = nowRef.current;
      if (!nowEl) return;
      const rect = nowEl.getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();
      setShowScrollBtn(rect.top < 0 || rect.top > containerRect.height);
      setCollapsed(el.scrollTop > 60);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToNow = () => {
    nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // 对话历史面板
  const ChatHistoryPanel = () => {
    if (!chatHistoryOpen) return null;
    const sessions = chatSessions();
    return (
      <div className="fixed inset-0 z-[75] flex flex-col" style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        <div className="flex-1" onClick={() => setChatHistoryOpen(false)}></div>
        <div className="mx-auto w-full max-w-lg flex flex-col rounded-t-2xl overflow-hidden animate-fade-in" style={{ height: '50%', background: '#fff', border: 'var(--border-card-hover)', borderBottom: 'none' }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: 'var(--border-header)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>对话历史</span>
            <button onClick={() => setChatHistoryOpen(false)} style={{ color: 'var(--text-tertiary)' }}><window.Kawa.Ic.Close /></button>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
            {sessions.length === 0 && (
              <div className="text-center py-10 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>还没有对话记录</div>
            )}
            {sessions.map(s => (
              <div key={s.id} className="p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-50"
                style={{ border: 'var(--border-card)' }}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{s.summary}</span>
                  <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{new Date(s.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{s.messageCount} 条消息</span>
                  {s.generatedEvents.length > 0 && <span>生成了 {s.generatedEvents.length} 张卡片</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-full w-full flex flex-col">
      <div className="absolute inset-0 beige-bg z-0"></div>
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] animate-in"><div className="px-5 py-2.5 text-xs font-light tracking-wide rounded-xl" style={{ color: 'var(--text-primary)', background: '#fff', border: 'var(--border-card)' }}>{toast}</div></div>}
      {storageWarn && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] animate-in" style={{ maxWidth: '90vw' }}><div className="px-5 py-2.5 text-xs font-light tracking-wide rounded-xl text-center" style={{ color: 'var(--color-error)', background: '#fff', border: '1px solid rgba(196,128,128,0.3)' }}>Safari 隐私设置阻止了本地存储。<br/>数据仅保存在 Supabase 云端，关闭页面后新数据可能丢失。<br/>建议使用 Chrome 访问，或在 Safari 设置中关闭「阻止所有 Cookie」。</div></div>}
      {objEditor !== null && <ObjEditor objective={objEditor === true ? null : objEditor} onSave={saveObj} onClose={() => setObjEditor(null)} />}

      <HUD objectives={objectives} events={events} todayTodos={todayTodos} onAddObj={() => setObjEditor(true)} onEditObj={o => setObjEditor(o)} onDeleteObj={deleteObj} onFilterObj={setActiveFilter} activeFilter={activeFilter} selectedDate={selectedDate} onSelectDate={setSelectedDate} isOpen={hudOpen} onToggle={() => setHudOpen(!hudOpen)} collapsed={collapsed} onExpandRequest={() => { feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); setCollapsed(false); }} onChatHistory={() => setChatHistoryOpen(true)} />

      <div ref={feedRef} className="flex-1 overflow-y-auto no-scrollbar flow-scroll pt-10 pb-32 px-5 z-10 relative"
        style={{ paddingTop: hudOpen ? '350px' : '170px', transition: 'padding-top 0.5s ease-out' }}>
        <div className="max-w-lg mx-auto">
          {(activeFilter || selectedDate) && <div className="flex items-center gap-2 mb-4 text-[10px]">
            <span style={{ color: 'var(--text-tertiary)' }}>筛选:</span>
            {activeFilter && <span style={{ color: objectives.find(o => o.id === activeFilter)?.color }}>{objectives.find(o => o.id === activeFilter)?.title}</span>}
            {selectedDate && <span style={{ color: 'var(--text-tertiary)' }}>{selectedDate}</span>}
            <button style={{ color: 'var(--text-tertiary)' }} onClick={() => { setActiveFilter(null); setSelectedDate(null); }}>清除</button>
          </div>}
          {filtered.length === 0 && !activeFilter && !selectedDate ? <EmptyWelcome /> : <>
            {renderTL(future)}
            <div ref={nowRef} className="flex items-center gap-3 py-10"><div className="flex-1 h-px" style={{ backgroundColor: 'rgba(184,181,224,0.2)' }}></div><span className="text-[10px] font-light tracking-[0.3em]" style={{ color: 'var(--accent-400)' }}>此时</span><div className="flex-1 h-px" style={{ backgroundColor: 'rgba(184,181,224,0.2)' }}></div></div>
            {renderTL(past)}
            <div className="py-16 text-center text-[10px] font-light tracking-widest" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>时间轴边界</div>
          </>}
        </div>
      </div>

      {showScrollBtn && (
        <button onClick={scrollToNow}
          className="fixed right-5 z-40 glass animate-fade-in flex items-center justify-center"
          style={{ bottom: '120px', width: 40, height: 40, borderRadius: '50%', background: '#fff', border: 'var(--border-card)' }}>
          <span className="text-xs" style={{ color: 'var(--accent-400)' }}>↓</span>
        </button>
      )}

      <Omnibox onSubmitText={handleSubmit} isProcessing={processing} onChatOpen={() => setChatOpen(true)}
  onImageSubmit={async (imageUrl, caption) => {
    const ev = {
      id: uid(), timeline_time: new Date().toISOString(), record_time: new Date().toISOString(),
      raw_content: caption || '[图片]', type: 'note', status: 'pending',
      ai_metadata: { task_title: caption ? (caption.length > 12 ? caption.substring(0,11)+'…' : caption) : '图片记录', progress_delta: 0 },
      image_url: imageUrl
    };
    setEvents(prev => [ev, ...prev]);
    await saveEventToSB(ev);
    toast_('图片已上传' + (caption ? ' · ' + caption.substring(0,20) : ''));
  }} />

      <ChatOverlay isOpen={chatOpen} onClose={() => setChatOpen(false)} onEventsGenerated={handleChatEvents} toast={toast_} />

      <ChatHistoryPanel />
    </div>
  );
};

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
} catch (err) {
  const fb = document.getElementById('fallback');
  if (fb) { fb.style.display = 'block'; fb.textContent = 'Error: ' + (err.message || err); }
  console.error(err);
}
