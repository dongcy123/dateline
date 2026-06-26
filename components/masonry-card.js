// ==========================================
// MasonryCard — 瀑布流卡片（非对称布局）
// 笔记：宽大 Ins 风文章卡（白底 + 左色条）
// 待办：紧凑便利贴（pastel 底色，88% 宽度偏移）
// ==========================================
window.Kawa = window.Kawa || {};

const STICKY = [
  { bg: '#FFFBE6', border: '#EEDD66', dot: '#E5C800' },
  { bg: '#FFF0F0', border: '#E8A0A0', dot: '#D46868' },
  { bg: '#E8F6E8', border: '#90C890', dot: '#5EA85E' },
  { bg: '#F0EAFF', border: '#C0B0E8', dot: '#8B6FC0' },
];

window.Kawa.MasonryCard = ({ card, objectives, relativeTime, onOpen }) => {
  const obj = objectives.find(o => o.id === card.objective_id);
  const title = card.ai_metadata?.task_title || card.raw_content?.slice(0, 20) || '';
  const body = card.raw_content || '';
  const hasImg = !!card.image_url;
  const isTodo = card.type === 'todo';
  const isDone = card.status === 'done';

  const titleNorm = title.replace(/\s/g, '');
  const bodyNorm = body.replace(/\s/g, '');
  const showBody = !isTodo && body && titleNorm !== bodyNorm && body !== title;

  const stickyIdx = isTodo ? (card.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % STICKY.length : 0;
  const sc = STICKY[stickyIdx];

  // ═══ 待办卡：紧凑便利贴 ═══
  if (isTodo) {
    return React.createElement('div', {
      className: 'transition-all duration-200 cursor-pointer active:scale-[0.97]',
      onClick: () => onOpen && onOpen(card),
      style: {
        width: '88%',
        margin: '0 auto',
        opacity: isDone ? 0.45 : 1,
      }
    },
      React.createElement('div', {
        style: {
          background: sc.bg,
          border: `1px solid ${sc.border}`,
          borderRadius: '12px',
          padding: '10px 12px',
          boxShadow: `0 1px 4px ${sc.border}25`,
          position: 'relative',
          overflow: 'hidden',
        }
      },
        // 装饰圆点
        React.createElement('div', {
          key: 'dot',
          style: {
            position: 'absolute', top: -4, right: -4,
            width: 14, height: 14, borderRadius: '50%',
            background: sc.dot, opacity: 0.25,
          }
        }),
        // 标题
        React.createElement('p', {
          key: 't',
          style: {
            fontSize: 13, fontWeight: 600, lineHeight: 1.3,
            color: 'var(--text-primary)', marginBottom: 6,
            textDecoration: isDone ? 'line-through' : 'none',
            letterSpacing: '-0.01em', wordBreak: 'break-word',
            paddingRight: 8,  // avoid overlapping dot
          }
        }, title),
        // 底部行
        React.createElement('div', {
          key: 'ft',
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }
        },
          obj
            ? React.createElement('span', { key: 'obj',
                style: { fontSize: 9, fontWeight: 500, padding: '1px 5px', borderRadius: 9999, background: obj.color + '14', color: obj.color, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
              }, obj.title)
            : React.createElement('span', { key: 'sp' }),
          React.createElement('span', { key: 'time',
            style: { fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6, whiteSpace: 'nowrap' }
          }, relativeTime(card.record_time))
        )
      )
    );
  }

  // ═══ 笔记卡：Ins 风宽大文章卡 ═══
  const accentColor = obj?.color || '#D4D4D4';

  return React.createElement('div', {
    className: 'transition-all duration-200 cursor-pointer active:scale-[0.98]',
    onClick: () => onOpen && onOpen(card),
    style: {
      background: '#fff',
      border: 'var(--border-card)',
      borderRadius: '16px',
      opacity: isDone ? 0.5 : 1,
      overflow: 'hidden',
      position: 'relative',
      boxShadow: hasImg ? '0 2px 12px rgba(0,0,0,0.05)' : 'none',
    }
  },
    // ── 左侧色条（纯文本卡）──
    !hasImg && React.createElement('div', {
      key: 'bar',
      style: {
        position: 'absolute', left: 0, top: 12, bottom: 12,
        width: 3, borderRadius: '0 3px 3px 0',
        background: accentColor, opacity: 0.5,
      }
    }),

    // ── 图片 ──
    hasImg && React.createElement('img', {
      key: 'img', src: card.image_url, alt: title,
      style: { width: '100%', display: 'block', objectFit: 'cover', maxHeight: 240 },
      loading: 'lazy',
    }),

    // ── 内容 ──
    React.createElement('div', {
      key: 'ct',
      style: { padding: hasImg ? '14px 16px 14px' : '16px 16px 14px 20px' }
    },
      // 标题（大号，无图片时更大）
      React.createElement('p', {
        key: 't',
        style: {
          fontSize: hasImg ? 15 : 17,
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--text-primary)',
          marginBottom: showBody ? 8 : 0,
          textDecoration: isDone ? 'line-through' : 'none',
          letterSpacing: '-0.015em',
          wordBreak: 'break-word',
        }
      }, title),

      // 正文（显示更多行——5 行）
      showBody && React.createElement('p', {
        key: 'b',
        style: {
          fontSize: 13,
          lineHeight: 1.65,
          color: 'var(--text-secondary)',
          display: '-webkit-box',
          WebkitLineClamp: 5,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginBottom: 10,
          wordBreak: 'break-word',
        }
      }, body),

      // 底部 meta
      React.createElement('div', {
        key: 'ft',
        style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: showBody ? 0 : 4 }
      },
        React.createElement('span', { key: 'type',
          style: { fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 9999, background: 'var(--accent-100)', color: 'var(--accent-500)' }
        }, '笔记'),
        obj && React.createElement('span', { key: 'obj',
          style: { fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 9999, background: obj.color + '14', color: obj.color, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
        }, obj.title),
        React.createElement('div', { key: 'sp', style: { flex: 1 } }),
        React.createElement('span', { key: 'time',
          style: { fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.6, whiteSpace: 'nowrap' }
        }, relativeTime(card.record_time))
      )
    )
  );
};
