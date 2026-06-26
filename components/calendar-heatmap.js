// ==========================================
// CalendarHeatmap — GitHub 风格贡献热力图
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.CalendarHeatmap = ({ events, selectedDate, onSelectDate }) => {
  const [expanded, setExpanded] = React.useState(false);

  // 构建日期 → 事件数映射
  const dateMap = React.useMemo(() => {
    const m = {};
    events.forEach(ev => {
      const ds = window.Kawa.tsDay(new Date(ev.record_time));
      m[ds] = (m[ds] || 0) + 1;
    });
    return m;
  }, [events]);

  // 生成最近 12 周的网格（7×12）
  const weeks = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 对齐到周六（每周最后一天）
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay())); // 本周六

    const start = new Date(end);
    start.setDate(start.getDate() - 83); // 12 周前

    const weeks = [];
    let cur = new Date(start);
    cur.setDate(cur.getDate() - cur.getDay()); // 对齐到周日

    while (cur <= end) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cur);
        const ds = window.Kawa.tsDay(d);
        week.push({ date: d, ds, count: dateMap[ds] || 0 });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [dateMap]);

  const levelColor = (count) => {
    if (count === 0) return 'rgba(0,0,0,0.04)';
    if (count <= 2) return 'rgba(139,127,184,0.25)';
    if (count <= 5) return 'rgba(139,127,184,0.50)';
    return 'rgba(139,127,184,0.80)';
  };

  const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
  const todayStr = window.Kawa.todayStr();

  const toggle = () => setExpanded(!expanded);

  // 收起态：一行迷你热力条
  if (!expanded) {
    return React.createElement('div', { className: 'px-5 mb-2' },
      React.createElement('button', {
        onClick: toggle,
        className: 'flex items-center gap-2 w-full text-left',
        style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer' }
      },
        React.createElement('span', {
          style: { fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }
        }, '📅 活动热力图'),
        React.createElement('div', { style: { display: 'flex', gap: 3, flex: 1, justifyContent: 'flex-end' } },
          weeks.slice(-6).map((week, wi) =>
            React.createElement('div', { key: wi, style: { display: 'flex', flexDirection: 'column', gap: 3 } },
              week.map((day, di) =>
                React.createElement('div', {
                  key: di,
                  style: {
                    width: 10, height: 10, borderRadius: 2,
                    backgroundColor: levelColor(day.count),
                    outline: day.ds === todayStr ? '1.5px solid var(--accent-400)' : 'none',
                    outlineOffset: 1,
                  }
                })
              )
            )
          )
        ),
        selectedDate && React.createElement('span', {
          onClick: (e) => { e.stopPropagation(); onSelectDate(null); },
          style: { fontSize: 10, color: 'var(--accent-500)', padding: '1px 6px', borderRadius: 9999, background: 'var(--accent-100)', cursor: 'pointer' }
        }, '✕ 清除'),
      )
    );
  }

  // 展开态：完整热力图
  return React.createElement('div', {
    className: 'px-5 py-3 mb-2 mx-3',
    style: { background: '#fff', borderRadius: 14, border: 'var(--border-card)' }
  },
    // 头部
    React.createElement('div', { key: 'h', className: 'flex items-center justify-between mb-3' },
      React.createElement('span', { key: 't', style: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' } }, '活动热力图'),
      React.createElement('button', { key: 'c', onClick: toggle,
        style: { fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }
      }, '收起'),
    ),

    // 图例
    React.createElement('div', { key: 'lg', className: 'flex items-center gap-1 mb-3', style: { justifyContent: 'flex-end' } },
      React.createElement('span', { key: 'l', style: { fontSize: 9, color: 'var(--text-tertiary)', marginRight: 4 } }, '少'),
      [0, 1, 3, 6].map(n => React.createElement('div', {
        key: n,
        style: { width: 12, height: 12, borderRadius: 3, backgroundColor: levelColor(n) }
      })),
      React.createElement('span', { key: 'r', style: { fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 4 } }, '多'),
    ),

    // 网格
    React.createElement('div', { key: 'g', style: { display: 'flex', justifyContent: 'center' } },
      React.createElement('div', { style: { display: 'flex', gap: 4 } },
        // 星期标签
        React.createElement('div', { key: 'dl', style: { display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4, paddingTop: 2 } },
          dayLabels.map((l, i) =>
            React.createElement('span', { key: i,
              style: { fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.5, width: 14, textAlign: 'right', lineHeight: '14px' }
            }, l)
          )
        ),
        // 周列
        weeks.map((week, wi) =>
          React.createElement('div', { key: wi, style: { display: 'flex', flexDirection: 'column', gap: 3 } },
            week.map((day, di) =>
              React.createElement('button', {
                key: di,
                onClick: () => onSelectDate(day.ds === selectedDate ? null : day.ds),
                title: `${day.ds}: ${day.count} 条记录`,
                style: {
                  width: 14, height: 14, borderRadius: 3,
                  backgroundColor: levelColor(day.count),
                  border: day.ds === todayStr ? '1.5px solid var(--accent-400)' : '1.5px solid transparent',
                  outline: day.ds === selectedDate ? '2px solid var(--accent-400)' : 'none',
                  outlineOffset: 2,
                  cursor: day.count > 0 || day.ds === todayStr ? 'pointer' : 'default',
                  padding: 0,
                  transition: 'transform 0.15s',
                }
              })
            )
          )
        )
      )
    ),

    // 选中日期提示
    selectedDate && React.createElement('div', { key: 'sel', className: 'text-center mt-2' },
      React.createElement('span', {
        style: { fontSize: 11, color: 'var(--accent-500)' }
      }, selectedDate + ' · ' + (dateMap[selectedDate] || 0) + ' 条记录'),
    ),
  );
};
