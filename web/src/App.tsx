import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import { load, save, storageAvailable } from '@/lib/storage';
import { loadFromSB, saveEventToSB, saveObjToSB, deleteEventFromSB } from '@/lib/supabase';
import { callAI, parseTime, matchObj } from '@/lib/ai';
import { uid, fmtTime, fmtDate, tsDay } from '@/lib/utils';
import { OBJ_PALETTE, TYPE_LABELS, EV_KEY, OBJ_KEY } from '@/lib/constants';
import type { TimelineEvent, Objective } from '@/types/event';
import { Top3Focus } from '@/components/Top3Focus';
import { TagNav } from '@/components/TagNav';
import { MasonryCard } from '@/components/MasonryCard';
import { CardDetail } from '@/components/CardDetail';
import { ChatOverlay } from '@/components/ChatOverlay';
import { CalendarHeatmap } from '@/components/CalendarHeatmap';
import { Omnibox } from '@/components/Omnibox';
import { Button } from '@/components/ui/button';

function App() {
  // ── 数据层 ──
  if (window.location.search.includes('reset') && storageAvailable()) {
    localStorage.removeItem(EV_KEY);
    localStorage.removeItem(OBJ_KEY);
  }

  const [events, setEvents] = useState<TimelineEvent[]>(() => { const d = load<TimelineEvent[]>(EV_KEY); return (d && d.length) ? d : []; });
  const [objectives, setObjectives] = useState<Objective[]>(() => { const d = load<Objective[]>(OBJ_KEY); return (d && d.length) ? d : []; });
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [storageWarn, setStorageWarn] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<TimelineEvent | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const fabFileRef = useRef<HTMLInputElement | null>(null);
  const fabTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!storageAvailable()) setStorageWarn(true); }, []);

  // Supabase 加载
  useEffect(() => {
    (async () => {
      const remote = await loadFromSB();
      if (remote) {
        if (remote.events.length > 0) { setEvents(remote.events as TimelineEvent[]); save(EV_KEY, remote.events); }
        if (remote.objectives.length > 0) { setObjectives(remote.objectives as Objective[]); save(OBJ_KEY, remote.objectives); }
      }
    })();
  }, []);

  useEffect(() => { const ok = save(EV_KEY, events); if (!ok && events.length > 0) setStorageWarn(true); }, [events]);
  useEffect(() => { const ok = save(OBJ_KEY, objectives); if (!ok && objectives.length > 0) setStorageWarn(true); }, [objectives]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    sonnerToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── v1.0 selectors ──

  const top3Todos = useMemo(() =>
    events
      .filter(e => e.type === 'todo' && e.status !== 'done')
      .sort((a, b) => new Date(a.timeline_time).getTime() - new Date(b.timeline_time).getTime())
      .slice(0, 3)
    , [events]);

  const allCards = useMemo(() => {
    const cards = events
      .map(e => ({ ...e, isCompleted: e.status === 'done' }))
      .sort((a, b) => {
        const aPinned = (a.ai_metadata as { pinned_at?: string })?.pinned_at ? 1 : 0;
        const bPinned = (b.ai_metadata as { pinned_at?: string })?.pinned_at ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        const aTime = aPinned ? new Date((a.ai_metadata as { pinned_at?: string }).pinned_at!).getTime() : new Date(a.record_time).getTime();
        const bTime = bPinned ? new Date((b.ai_metadata as { pinned_at?: string }).pinned_at!).getTime() : new Date(b.record_time).getTime();
        return bTime - aTime;
      });
    let filtered = cards;
    if (activeTag) filtered = filtered.filter(e => e.objective_id === activeTag);
    if (selectedDate) {
      filtered = filtered.filter(e => tsDay(new Date(e.record_time)) === selectedDate);
    }
    return filtered;
  }, [events, activeTag, selectedDate]);

  // ── Actions ──

  const handleSubmit = async (text: string) => {
    if (/^\/目标[：:]\s*(.+)/.test(text) || /^\/obj[：:]\s*(.+)/i.test(text)) {
      const m = text.match(/^(?:\/目标|\/obj)[：:]\s*(.+)/);
      const title = m![1].trim();
      const newObj: Objective = { id: uid(), title, target: 100, current: 0, color: OBJ_PALETTE[Math.floor(Math.random() * OBJ_PALETTE.length)] };
      setObjectives(prev => [...prev, newObj]);
      saveObjToSB(newObj as unknown as Record<string, unknown>);
      showToast('目标「' + title + '」已创建'); return;
    }

    setProcessing(true);
    try {
      const { result: aiRes, aiPending } = await callAI(text, objectives);
      const aiFallback = !!aiPending;

      if (aiRes.type === 'objective') {
        const aiObj: Objective = { id: uid(), title: aiRes.ai_metadata?.task_title || text, target: 100, current: 0, color: aiRes.ai_metadata?.color || OBJ_PALETTE[Math.floor(Math.random() * OBJ_PALETTE.length)] };
        setObjectives(prev => [...prev, aiObj]);
        saveObjToSB(aiObj as unknown as Record<string, unknown>);
        showToast('AI 创建目标「' + (aiRes.ai_metadata?.task_title || text) + '」'); setProcessing(false); return;
      }
      let tl: Date | null = aiRes.timeline_time ? new Date(aiRes.timeline_time) : null;
      if (!tl || isNaN(tl.getTime())) tl = parseTime(text);
      const oid = aiRes.objective_id || matchObj(text, objectives);
      const isKeyNode = aiRes.is_key_node || false;
      const evId = uid();
      const ev: TimelineEvent = { id: evId, timeline_time: tl.toISOString(), record_time: new Date().toISOString(), raw_content: text, type: aiRes.type || 'note', status: 'pending', objective_id: oid || undefined, is_key_node: isKeyNode, ai_metadata: aiRes.ai_metadata || {} };
      setEvents(prev => [ev, ...prev]);
      setProcessing(false);

      const on = objectives.find(o => o.id === oid);
      showToast(TYPE_LABELS[ev.type] + ' · ' + fmtDate(tl) + ' ' + fmtTime(tl) + (on ? ' → ' + on.title : '') + (aiFallback ? ' [本地解析]' : ''));
      saveEventToSB(ev as unknown as Record<string, unknown>);

      if (aiPending) {
        aiPending.then((lateAi: unknown) => {
          const late = lateAi as { type?: string; objective_id?: string; ai_metadata?: Record<string, unknown>; timeline_time?: string; is_key_node?: boolean } | null;
          if (!late || late.type === 'objective') return;
          setEvents(prev => prev.map(e => {
            if (e.id !== evId) return e;
            const lateTl = late.timeline_time ? new Date(late.timeline_time) : tl!;
            const lateOid = late.objective_id || matchObj(text, objectives);
            return { ...e, type: (late.type || e.type) as TimelineEvent['type'], ai_metadata: { ...e.ai_metadata, ...(late.ai_metadata || {}) }, timeline_time: (lateTl && !isNaN(lateTl.getTime())) ? lateTl.toISOString() : e.timeline_time, objective_id: lateOid || e.objective_id, is_key_node: late.is_key_node || e.is_key_node };
          }));
        });
      }
    } catch (e: unknown) { showToast('⚠ ' + (e instanceof Error ? e.message : '出错')); }
    finally { setProcessing(false); }
  };

  const confirmEvent = (id: string) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, status: 'done' as const } : e);
      const ev = updated.find(e => e.id === id);
      if (ev) saveEventToSB(ev as unknown as Record<string, unknown>);
      return updated;
    });
    showToast('✓ 已完成');
  };

  const handleCardSave = (id: string, data: TimelineEvent) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...data } : e);
      const ev = updated.find(e => e.id === id);
      if (ev) saveEventToSB(ev as unknown as Record<string, unknown>);
      return updated;
    });
    setSelectedCard(prev => prev?.id === id ? { ...(prev as TimelineEvent), ...data } : prev);
    showToast('已保存');
  };

  const handleCardDelete = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    deleteEventFromSB(id);
    showToast('已删除');
  };

  const relativeTime = (isoStr: string): string => {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + '分钟前';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + '小时前';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + '天前';
    return fmtDate(d);
  };


  return (
    <div className="relative h-full w-full flex flex-col">
      <div className="absolute inset-0 beige-bg z-0"></div>

      <Toaster position="top-center" toastOptions={{
        style: { background: '#fff', border: '0.5px solid hsl(var(--border))', color: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 300, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
      }} />

      {toast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[80] animate-in pointer-events-none">
          <div className="px-5 py-2.5 text-xs font-light tracking-wide rounded-xl"
            style={{ background: '#fff', border: '0.5px solid hsl(var(--border))', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            {toast}
          </div>
        </div>
      )}

      {/* AI 对话浮层 */}
      <ChatOverlay isOpen={chatOpen} onClose={() => setChatOpen(false)}
        onEventsGenerated={(rawEvs) => {
          const now = new Date().toISOString();
          const evs: TimelineEvent[] = rawEvs.map(ev => ({
            ...ev,
            id: ev.id || uid(),
            timeline_time: ev.timeline_time || now,
            record_time: ev.record_time || now,
            status: ev.status || 'pending',
            type: ev.type || 'note',
            ai_metadata: ev.ai_metadata || {},
            raw_content: ev.raw_content || '',
          }));
          setEvents(prev => [...evs, ...prev]);
          evs.forEach(ev => saveEventToSB(ev as unknown as Record<string, unknown>));
        }}
        showToast={showToast} />

      {/* 卡片详情浮层 */}
      {selectedCard && (
        <CardDetail card={selectedCard} objectives={objectives} onClose={() => setSelectedCard(null)}
          onSave={handleCardSave} onDelete={handleCardDelete} />
      )}

      {/* 隐藏文件选择器 */}
      <input ref={fabFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={(_e) => {
          clearTimeout(fabTimeoutRef.current!);
          if (fabFileRef.current) fabFileRef.current.value = '';
        }} />

      {storageWarn && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] animate-in" style={{ maxWidth: '90vw' }}>
          <div className="px-5 py-2.5 text-xs font-light tracking-wide rounded-xl text-center"
            style={{ color: 'hsl(var(--destructive))', background: '#fff', border: '1px solid hsl(var(--destructive) / 0.3)' }}>
            Safari 隐私设置阻止了本地存储。<br/>数据仅保存在 Supabase 云端。
          </div>
        </div>
      )}

      {/* FAB 快速创建 */}
      <Button
        onClick={() => {
          fabFileRef.current?.click();
          fabTimeoutRef.current = setTimeout(() => { /* editor open */ }, 600);
        }}
        className="fixed z-60 flex items-center justify-center shadow-lg transition-transform active:scale-90 rounded-full"
        style={{ right: 20, bottom: 110, width: 50, height: 50, background: 'hsl(var(--primary))', color: '#fff', fontSize: 24 }}
        title="写笔记"
      >
        +
      </Button>

      {/* ───── 主内容区 ───── */}
      <div className="flex-1 overflow-y-auto no-scrollbar flow-scroll relative z-10">

        {/* Header */}
        <div className="px-5 pt-6 pb-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-[-0.02em]">川上</h1>
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(184,181,224,0.12)', color: 'hsl(var(--primary))' }}>
              v1.0
            </span>
          </div>
        </div>

        {/* ══ 日历热力图 ══ */}
        <CalendarHeatmap events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        {/* ══ 模块一：Top 3 待办 ══ */}
        <div className="mb-6">
          <div className="px-5 mb-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
              当前待办 · {top3Todos.length}/3
            </h2>
          </div>
          <Top3Focus todos={top3Todos} objectives={objectives} onComplete={confirmEvent} />
        </div>

        {/* ══ Tag 导航栏 ══ */}
        <TagNav objectives={objectives} activeTag={activeTag} onChange={setActiveTag} />

        {/* ══ 模块二：沉淀瀑布流 ══ */}
        <div className="px-3">
          <div className="px-2 mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
              沉淀 · {allCards.length} 条记录
            </h2>
          </div>

          {/* 瀑布流 — 双列均分，每卡独立 */}
          <div className="flex gap-3">
            {(() => {
              const cols = 2;
              const bins: TimelineEvent[][] = Array.from({ length: cols }, () => []);
              allCards.forEach((card, idx) => {
                bins[idx % cols].push(card);
              });
              return bins.map((col, ci) => (
                <div key={ci} className="flex-1 flex flex-col gap-3">
                  {col.map(card => (
                    <MasonryCard key={card.id} card={card} objectives={objectives} relativeTime={relativeTime} onOpen={setSelectedCard} onComplete={confirmEvent} />
                  ))}
                </div>
              ));
            })()}
          </div>

          {allCards.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[13px] font-medium text-muted-foreground">还没有记录</p>
              <p className="text-[11px] mt-1 text-muted-foreground opacity-60">在下方输入框开始书写</p>
            </div>
          )}

          <div className="h-32"></div>
        </div>
      </div>

      {/* Omnibox */}
      <div className="relative z-20 flex-shrink-0">
        <Omnibox onSubmitText={handleSubmit} isProcessing={processing}
          onChatOpen={() => setChatOpen(true)}
          onImageSubmit={(url, caption) => {
            const ev: TimelineEvent = {
              id: uid(), timeline_time: new Date().toISOString(), record_time: new Date().toISOString(),
              raw_content: caption || '[图片]', type: 'note', status: 'pending',
              ai_metadata: { task_title: caption ? (caption.length > 12 ? caption.substring(0, 11) + '…' : caption) : '图片记录', progress_delta: 0 },
            };
            (ev as { image_url?: string }).image_url = url;
            setEvents(prev => [ev, ...prev]);
            saveEventToSB(ev as unknown as Record<string, unknown>);
            showToast('图片已上传');
          }} />
      </div>
    </div>
  );
}

export default App;
