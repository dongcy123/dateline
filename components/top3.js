// ==========================================
// Top 3 Focus — 当前待办便利贴
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.Top3Focus = ({ todos, objectives, onComplete }) => {
  const STICKY = [
    { bg: '#FFFBE6', border: '#EEDD66', dot: '#E5C800', shadow: 'rgba(238,221,102,0.30)' },
    { bg: '#FFF0F0', border: '#E8A0A0', dot: '#D46868', shadow: 'rgba(232,160,160,0.25)' },
    { bg: '#E8F6E8', border: '#90C890', dot: '#5EA85E', shadow: 'rgba(144,200,144,0.25)' },
    { bg: '#F0EAFF', border: '#C0B0E8', dot: '#8B6FC0', shadow: 'rgba(192,176,232,0.28)' },
  ];

  const [completing, setCompleting] = React.useState(null);

  const handleCheck = (id) => {
    setCompleting(id);
    setTimeout(() => {
      setCompleting(null);
      onComplete(id);
    }, 420);
  };

  if (!todos || todos.length === 0) {
    return (
      <div className="px-5 py-10 text-center select-none">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
          style={{ background: '#fff', border: 'var(--border-card)' }}>
          <span className="text-2xl">☕</span>
        </div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>暂无待办</p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>在下方输入框记录你的第一个任务</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto no-scrollbar snap-x snap-mandatory"
      style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-3 px-5 py-3" style={{ minWidth: 'min-content' }}>
        {todos.map((ev, i) => {
          const obj = objectives.find(o => o.id === ev.objective_id);
          const c = STICKY[i % STICKY.length];
          const dueDate = new Date(ev.timeline_time);
          const recDate = new Date(ev.record_time);
          const now = new Date();
          const isOverdue = dueDate < now && dueDate.toDateString() !== now.toDateString();

          // 相对时间（基于 record_time）
          const diffMs = now - recDate;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHrs = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);
          let dayLabel;
          if (diffMins < 1) dayLabel = '刚刚';
          else if (diffMins < 60) dayLabel = diffMins + '分钟前';
          else if (diffHrs < 24) dayLabel = diffHrs + '小时前';
          else if (diffDays === 1) dayLabel = '昨天';
          else if (diffDays < 7) dayLabel = diffDays + '天前';
          else if (diffDays < 30) dayLabel = Math.floor(diffDays / 7) + '周前';
          else dayLabel = Math.floor(diffDays / 30) + '个月前';

          const title = ev.ai_metadata?.task_title || ev.raw_content.slice(0, 15);
          const isThisCompleting = completing === ev.id;

          return (
            <div key={ev.id}
              className={`flex-shrink-0 snap-start transition-all duration-300`}
              style={{
                width: '160px',
                opacity: isThisCompleting ? 0 : 1,
                transform: isThisCompleting ? 'scale(0.92) translateY(8px)' : 'scale(1) translateY(0)',
              }}>
              <div className="flex flex-col h-full p-3.5 cursor-pointer transition-shadow hover:shadow-md relative overflow-hidden"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: '14px',
                  boxShadow: `0 2px 10px ${c.shadow}`,
                  minHeight: '130px',
                }}
                onClick={() => handleCheck(ev.id)}>

                {/* 装饰圆点 */}
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full opacity-30"
                  style={{ background: c.dot }}></div>

                {/* Checkbox */}
                <div className="flex items-start gap-2.5 mb-2">
                  <button
                    className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200 active:scale-90"
                    style={{
                      border: `2px solid ${c.border}`,
                      backgroundColor: 'rgba(255,255,255,0.7)',
                    }}
                    onClick={e => { e.stopPropagation(); handleCheck(ev.id); }}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="opacity-0 transition-opacity duration-200"
                      style={{ opacity: 0 }}>
                      <path d="M1 4L3.5 6.5L9 1" stroke={c.dot} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <p className="text-[13px] font-semibold leading-snug flex-1 line-clamp-3"
                    style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    {title}
                  </p>
                </div>

                {/* 底部：日期 + 目标标签 */}
                <div className="flex items-center justify-between mt-auto pt-2"
                  style={{ borderTop: `1px solid ${c.border}40` }}>
                  <span className="text-[10px] tabular-nums font-medium"
                    style={{ color: isOverdue ? 'var(--color-error)' : 'var(--text-tertiary)' }}>
                    {isOverdue ? '⚠ ' : ''}{dayLabel}
                  </span>
                  {obj && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-medium truncate max-w-[64px]"
                      style={{ backgroundColor: obj.color + '18', color: obj.color }}>
                      {obj.title}
                    </span>
                  )}
                  {!obj && (
                    <span className="text-[9px] font-medium"
                      style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>待办</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 尾部留白，确保最后一张卡片完整显示 */}
        <div className="flex-shrink-0" style={{ width: '4px' }}></div>
      </div>
    </div>
  );
};
