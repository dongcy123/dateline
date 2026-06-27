// ==========================================
// CardDetail — 卡片详情浮层（内容优先）
// 图片大尺寸展示 · 标题+正文为重心 · 属性一行收起
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.CardDetail = ({ card, objectives, onClose, onSave, onDelete }) => {
  const [editing, setEditing] = React.useState(false);
  const [editData, setEditData] = React.useState(card);
  const [showDel, setShowDel] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const obj = objectives.find(o => o.id === editData.objective_id);
  const isPinned = !!card.ai_metadata?.pinned_at;
  const title = card.ai_metadata?.task_title || card.raw_content?.slice(0, 20) || '';
  const isTodo = card.type === 'todo';
  const isDone = card.status === 'done';
  const { fmtTime, fmtDate } = window.Kawa;

  // 相对时间
  const diffMs = Date.now() - new Date(card.record_time).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  let relTime;
  if (diffMins < 1) relTime = '刚刚';
  else if (diffMins < 60) relTime = diffMins + '分钟前';
  else if (diffHrs < 24) relTime = diffHrs + '小时前';
  else if (diffDays === 1) relTime = '昨天';
  else if (diffDays < 7) relTime = diffDays + '天前';
  else relTime = fmtDate(new Date(card.record_time));

  React.useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePin = () => {
    const newMeta = { ...card.ai_metadata };
    if (isPinned) { delete newMeta.pinned_at; }
    else { newMeta.pinned_at = new Date().toISOString(); }
    onSave(card.id, { ...card, ai_metadata: newMeta });
  };

  const handleDelete = () => { onDelete(card.id); onClose(); };

  const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 10, background: 'rgba(0,0,0,0.015)', outline: 'none',
    color: 'var(--text-primary)', fontFamily: 'inherit',
  };

  return React.createElement('div', {
    className: 'fixed inset-0 z-[70] flex items-center justify-center p-4',
    style: { background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' },
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
  },
    React.createElement('div', {
      className: 'w-full max-w-lg mx-auto flex flex-col overflow-hidden animate-fade-in',
      style: { background: '#fff', borderRadius: 20, maxHeight: '85vh', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }
    },
      // ── 顶部栏：关闭 · 编辑 · 置顶 ──
      React.createElement('div', { key: 'top', className: 'flex items-center gap-2 px-4 pt-3 pb-1 flex-shrink-0' },
        React.createElement('button', { key: 'close', onClick: onClose,
          className: 'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
          style: { color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.04)' }
        }, '✕'),
        React.createElement('div', { key: 'sp', style: { flex: 1 } }),
        React.createElement('button', { key: 'pin', onClick: handlePin,
          className: 'w-8 h-8 flex items-center justify-center rounded-full transition-colors text-base',
          style: { background: isPinned ? 'var(--accent-100)' : 'rgba(0,0,0,0.04)' }
        }, isPinned ? '📌' : '📍'),
        !editing && React.createElement('button', { key: 'edit', onClick: () => setEditing(true),
          className: 'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
          style: { color: 'var(--accent-500)', background: 'rgba(0,0,0,0.04)' }
        }, '✎'),
      ),

      // ── 滚动内容 ──
      React.createElement('div', { key: 'scroll', className: 'overflow-y-auto no-scrollbar', style: { flex: 1 } },

        // ─── 多图展示 ───
        (() => {
          const allImgs = card.ai_metadata?.images || (card.image_url ? [card.image_url] : []);
          if (allImgs.length === 0) return null;
          if (allImgs.length === 1) {
            return React.createElement('img', { key: 'img', src: allImgs[0], alt: title,
              style: { width: '100%', display: 'block', objectFit: 'contain', maxHeight: '50vh' }
            });
          }
          // 多图：水平滚动
          return React.createElement('div', { key: 'imgs', className: 'overflow-x-auto no-scrollbar',
            style: { display: 'flex', gap: 4, padding: '0 4px' }
          },
            allImgs.map((url, i) =>
              React.createElement('img', { key: i, src: url, alt: title + ' ' + (i+1),
                style: { height: '40vh', width: 'auto', flexShrink: 0, borderRadius: 4, objectFit: 'cover' }
              })
            )
          );
        })(),

        // ─── 内容区 ───
        React.createElement('div', { key: 'content', style: { padding: '20px 20px 16px' } },

          // 标题
          editing
            ? React.createElement('input', { key: 't',
                value: editData.ai_metadata?.task_title || '',
                onChange: e => setEditData({ ...editData, ai_metadata: { ...editData.ai_metadata, task_title: e.target.value } }),
                placeholder: '标题', style: { ...inputStyle, fontSize: 22, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em' }
              })
            : React.createElement('h2', { key: 't',
                style: { fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 12, textDecoration: isDone ? 'line-through' : 'none' }
              }, title),

          // 正文
          editing
            ? React.createElement('textarea', { key: 'b',
                value: editData.raw_content || '',
                onChange: e => setEditData({ ...editData, raw_content: e.target.value }),
                rows: 6, placeholder: '正文内容',
                style: { ...inputStyle, minHeight: 100, lineHeight: 1.65, resize: 'vertical', marginBottom: 12 }
              })
            : card.raw_content && React.createElement('p', { key: 'b',
                style: { fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12 }
              }, card.raw_content),

          // ─── 属性行（一行紧凑）───
          React.createElement('div', { key: 'meta-row',
            style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)' }
          },
            // 类型
            React.createElement('span', { key: 'type', style: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999,
              background: isTodo ? 'rgba(196,128,128,0.1)' : 'var(--accent-100)',
              color: isTodo ? 'var(--color-error)' : 'var(--accent-500)' }
            }, isTodo ? '待办' : '笔记'),

            // 已完成标记
            isDone && React.createElement('span', { key: 'done', style: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999,
              background: 'rgba(126,184,160,0.12)', color: 'var(--color-success)' }
            }, '✓ 已完成'),

            // 关联目标
            obj && React.createElement('span', { key: 'obj', style: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999,
              background: obj.color + '14', color: obj.color }
            }, obj.title),

            React.createElement('div', { key: 'sp2', style: { flex: 1, minWidth: 4 } }),

            // 时间
            React.createElement('span', { key: 'time', style: { fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.7, whiteSpace: 'nowrap' } },
              relTime)
          ),

          // ─── 编辑模式：额外字段 ───
          editing && React.createElement('div', { key: 'edit-fields', style: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 } },
            React.createElement('div', { key: 'r1', style: { display: 'flex', gap: 8 } },
              React.createElement('select', { key: 'type-sel', value: editData.type,
                onChange: e => setEditData({ ...editData, type: e.target.value }),
                style: { ...inputStyle, flex: 1, fontSize: 13 }
              }, React.createElement('option', { value: 'note' }, '笔记'), React.createElement('option', { value: 'todo' }, '待办')),
              React.createElement('select', { key: 'obj-sel', value: editData.objective_id || '',
                onChange: e => setEditData({ ...editData, objective_id: e.target.value || null }),
                style: { ...inputStyle, flex: 1, fontSize: 13 }
              }, React.createElement('option', { value: '' }, '不关联目标'), ...objectives.map(o => React.createElement('option', { key: o.id, value: o.id }, o.title)))
            ),
            React.createElement('div', { key: 'r2', style: { display: 'flex', gap: 8, alignItems: 'center' } },
              React.createElement('input', { key: 'time', type: 'datetime-local',
                value: (() => { const d = new Date(editData.timeline_time); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); })(),
                onChange: e => { const v = e.target.value; if (v) setEditData({ ...editData, timeline_time: new Date(v).toISOString() }); },
                style: { ...inputStyle, flex: 1, fontSize: 13 }
              }),
              React.createElement('label', { key: 'done-cb', style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-secondary)' } },
                React.createElement('input', { type: 'checkbox', checked: editData.status === 'done',
                  onChange: e => setEditData({ ...editData, status: e.target.checked ? 'done' : 'pending' }),
                  style: { accentColor: 'var(--accent-400)' }
                }), '已完成')
            ),
            editData.objective_id && React.createElement('label', { key: 'kn', style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' } },
              React.createElement('input', { type: 'checkbox', checked: editData.is_key_node || false,
                onChange: e => setEditData({ ...editData, is_key_node: e.target.checked, ai_metadata: { ...editData.ai_metadata, progress_delta: e.target.checked ? (editData.ai_metadata?.progress_delta || 1) : 0 } }),
                style: { accentColor: 'var(--accent-400)' }
              }), '关键节点 · 贡献进度')
          ),

          // ─── 编辑模式按钮 ───
          editing && React.createElement('div', { key: 'edit-btns', style: { display: 'flex', gap: 10, marginTop: 12 } },
            React.createElement('button', { key: 'cancel', onClick: () => { setEditing(false); setEditData(card); },
              style: { flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 500, borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: 'var(--text-tertiary)' }
            }, '取消'),
            React.createElement('button', { key: 'save', onClick: () => { setSaving(true); onSave(card.id, editData); setSaving(false); setEditing(false); },
              style: { flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, borderRadius: 12,
                border: 'none', background: 'var(--accent-400)', color: '#fff', opacity: saving ? 0.6 : 1 }
            }, '保存'),
          )
        )
      ),

      // ── 底部删除（非编辑模式）──
      !editing && React.createElement('div', { key: 'footer', className: 'flex-shrink-0 px-4 pb-4 pt-1' },
        showDel
          ? React.createElement('div', { key: 'del-confirm', style: { display: 'flex', gap: 8 } },
              React.createElement('button', { key: 'no', onClick: () => setShowDel(false),
                style: { flex: 1, padding: '10px 0', fontSize: 13, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', background: '#fff', color: 'var(--text-secondary)' }
              }, '取消'),
              React.createElement('button', { key: 'yes', onClick: handleDelete,
                style: { flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 12, border: 'none', background: 'var(--color-error)', color: '#fff' }
              }, '确认删除'),
            )
          : React.createElement('button', { key: 'del', onClick: () => setShowDel(true),
              style: { width: '100%', padding: '10px 0', fontSize: 13, borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.05)', background: '#fff', color: 'var(--text-tertiary)' }
            }, '删除'),
      )
    )
  );
};
