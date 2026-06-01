// ==========================================
// HUD — 川上标题 + 目标球体 + 日历热力
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.HUD = ({ objectives, events, todayTodos, onAddObj, onEditObj, onDeleteObj, onFilterObj, activeFilter, selectedDate, onSelectDate, isOpen, onToggle, collapsed, onExpandRequest, onChatHistory }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const { Ic } = window.Kawa;

  const dayStats = React.useMemo(() => {
    const stats = {};
    events.forEach(e => {
      const d = new Date(e.timeline_time);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const k = d.getDate();
        if (!stats[k]) stats[k] = { total: 0, objs: {} };
        stats[k].total++;
        const oid = e.objective_id || '_none';
        stats[k].objs[oid] = (stats[k].objs[oid] || 0) + 1;
      }
    });
    return stats;
  }, [events, year, month]);

  // 迷你圆圈 — 折叠态使用
  const SmallCircle = ({ o }) => {
    const pct = o.target > 0 ? Math.min((o.current / o.target) * 100, 100) : 0;
    return React.createElement('div', { className: 'relative', style: { width: 20, height: 20, borderRadius: '50%', overflow: 'hidden' } },
      React.createElement('div', { className: 'absolute inset-0 rounded-full', style: { border: '1.5px solid ' + o.color, zIndex: 1 } }),
      React.createElement('div', { className: 'absolute bottom-0 left-0 right-0', style: { height: pct + '%', backgroundColor: o.color, opacity: 0.75 } })
    );
  };

  // OKR 进度球体
  const ObjSphere = ({ o, size = 64 }) => {
    const pct = o.target > 0 ? Math.min((o.current / o.target) * 100, 100) : 0;
    const active = activeFilter === o.id;
    const longPressRef = React.useRef(null);
    const fillColor = o.color;
    const s = size;

    const startPress = () => { longPressRef.current = setTimeout(() => onEditObj(o), 600); };
    const endPress = () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } };
    const click = () => { if (longPressRef.current) return; onFilterObj(active ? null : o.id); };

    const baseBg = '#EDE7E0';
    const gloss = 'radial-gradient(circle at 35% 28%, rgba(255,255,255,0.4) 0%, transparent 50%)';
    const glow = active
      ? '0 0 16px ' + fillColor + '55, 0 0 36px ' + fillColor + '20'
      : '0 2px 10px rgba(139,127,184,0.10)';

    return (
      <div className="flex flex-col items-center gap-1.5 select-none"
        onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
        onTouchStart={startPress} onTouchEnd={endPress}
        onClick={click}>
        <div className="relative cursor-pointer transition-transform duration-300 hover:scale-105" style={{ width: s, height: s }}>
          <div className="absolute inset-0 rounded-full" style={{ background: baseBg, boxShadow: glow }} />
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 transition-all duration-800 ease-out"
              style={{ height: pct + '%', backgroundColor: fillColor, opacity: 0.88, borderRadius: pct > 98 ? '50%' : '0 0 50% 50%' }} />
          </div>
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: gloss }} />
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: '1px solid ' + (active ? 'rgba(184,181,224,0.5)' : 'rgba(184,181,224,0.15)') }} />
          {active && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-medium tabular-nums" style={{ color: pct > 55 ? '#fff' : 'var(--text-secondary)' }}>
                {Math.round(pct)}%
              </span>
            </div>
          )}
        </div>
        {active && (
          <span className="text-[9px] text-center leading-tight max-w-[70px] truncate" style={{ color: fillColor, fontWeight: '500' }}>
            {o.title.length > 6 ? o.title.slice(0, 6) + '…' : o.title}
          </span>
        )}
      </div>
    );
  };

  const renderOrb = (d) => {
    const s = dayStats[d] || { total: 0, objs: {} };
    const hasData = s.total > 0;
    const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let bgStyle = { backgroundColor: '#EDE7E0' };
    if (hasData) {
      const entries = Object.entries(s.objs);
      if (entries.length >= 1) {
        const total = entries.reduce((sum, [, c]) => sum + c, 0);
        const gradients = entries.map(([oid, count], i) => {
          const o = objectives.find(x => x.id === oid);
          const color = o?.color || '#B8B5E0';
          const ratio = count / total;
          return 'radial-gradient(circle at ' + (30 + (i * 30)) + '% ' + (40 + (i * 20)) + '%, ' + color + Math.round(ratio * 90) + ' 0%, transparent 65%)';
        });
        bgStyle = {
          background: gradients.join(', ') + ', #EDE7E0',
          boxShadow: hasData ? '0 0 ' + (8 + s.total * 3) + 'px rgba(139,127,184,' + Math.min(s.total * 0.08, 0.25) + ')' : 'none',
        };
      }
    }
    const sel = selectedDate === dateStr;
    return (
      <div key={d} onClick={() => onSelectDate(sel ? null : dateStr)}
        className={'aspect-square rounded-full flex items-center justify-center text-[10px] cursor-pointer transition-all duration-300 hover:scale-110 relative ' + (sel ? 'ring-1 scale-110' : '')}
        style={{ ...bgStyle, ...(sel ? { boxShadow: '0 0 0 2px var(--accent-400)' } : {}) }}>
        <span className="relative z-10 font-light" style={{ color: hasData || sel ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{d}</span>
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="px-5 pt-4 pb-3" style={{ background: '#fff', borderBottom: 'var(--border-header)' }}>
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-light tracking-[0.12em]" style={{ color: 'var(--text-primary)' }}>川上</h1>

          <div className="flex-1 flex justify-center items-center"
            style={{
              opacity: collapsed ? 1 : 0,
              maxHeight: collapsed ? '40px' : '0px',
              transition: 'opacity 0.35s ease, max-height 0.35s ease',
              pointerEvents: collapsed ? 'auto' : 'none'
            }}
            onClick={(e) => { e.stopPropagation(); if (onExpandRequest) onExpandRequest(); }}>
            <div className="flex items-center gap-2.5 cursor-pointer">
              {objectives.slice(0, 5).map(o => <SmallCircle key={o.id} o={o} />)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onChatHistory && (
              <button onClick={onChatHistory} className="text-[10px] transition-colors tracking-wider" style={{ color: 'var(--text-tertiary)' }} title="对话历史">
                <Ic.History />
              </button>
            )}
            <button onClick={onToggle} className="text-[10px] transition-colors tracking-wider whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
              {isOpen ? '收起日历' : '展开日历'}
            </button>
          </div>
        </div>

        <div style={{
          maxHeight: collapsed ? '0px' : '300px',
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
          transition: 'max-height 0.4s ease, opacity 0.3s ease, margin 0.35s ease',
          marginTop: collapsed ? '0px' : '12px',
          marginBottom: collapsed ? '0px' : '4px'
        }}>
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 mb-3">
            <div className="flex items-center justify-center gap-5 min-w-min">
              {objectives.map(o => <ObjSphere key={o.id} o={o} size={58} />)}
              {objectives.length === 0 && (
                <div className="text-[10px] py-4" style={{ color: 'var(--text-tertiary)' }}>还没有目标，输入 "/目标 名称" 创建</div>
              )}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer select-none" onClick={onAddObj}>
                <div className="rounded-full flex items-center justify-center transition-colors"
                  style={{ width: 58, height: 58, border: '1px dashed rgba(139,127,184,0.25)' }}>
                  <Ic.Plus />
                </div>
                <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>新建</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: 'var(--text-tertiary)' }}>今日待办 <span style={{ color: 'var(--text-primary)', fontWeight: '500', fontFamily: '"SF Mono","Menlo","Cascadia Code",monospace' }}>{todayTodos.done}/{todayTodos.total}</span></span>
            <span className="text-[9px]" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>点击筛选 · 长按编辑</span>
          </div>
        </div>
      </div>

      {/* 日历热力 */}
      <div className={'overflow-hidden transition-all duration-500 ease-out ' + (isOpen ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0')}>
        <div className="px-4 pb-4" style={{ background: '#fff', borderBottom: 'var(--border-header)' }}>
          <div className="flex justify-between items-center mb-3 pt-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            <span>{year}年 {month + 1}月</span>
            {(activeFilter || selectedDate) && <button onClick={() => { onFilterObj(null); onSelectDate(null); }} style={{ color: 'var(--text-tertiary)' }}>清除筛选</button>}
          </div>
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
            {['一', '二', '三', '四', '五', '六', '日'].map(w => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startOffset }).map((_, i) => <div key={'e' + i}></div>)}
            {Array.from({ length: daysInMonth }).map((_, i) => renderOrb(i + 1))}
          </div>
          <div className="flex justify-center gap-4 mt-3 text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
            {objectives.slice(0, 4).map(o =>
              <div key={o.id} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color }}></span>{o.title.length > 6 ? o.title.slice(0, 6) + '…' : o.title}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
