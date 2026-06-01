// ==========================================
// EventCard — 扁平卡片 + 2px 激光色条
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.EventCard = ({ event, objectives, onConfirm, onUpdate, onDelete }) => {
  const [editing, setEditing] = React.useState(false);
  const [editData, setEditData] = React.useState(event);
  const [showDel, setShowDel] = React.useState(false);
  const d = new Date(event.timeline_time);
  const obj = objectives.find(o => o.id === event.objective_id);
  const accent = obj?.color || '#B8B5E0';
  const pending = event.status === 'pending';
  const { fmtTime, fmtDate, Ic, TYPE_LABELS, OBJ_PALETTE } = window.Kawa;

  if (editing) {
    return (
      <div className="mb-8 animate-fade-in">
        <div className="flex justify-center mb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
        </div>
        <div className="p-4" style={{ background: '#fff', border: 'var(--border-card)', borderRadius: '12px', borderLeft: '2px solid ' + accent }}>
          <div className="text-[10px] mb-2" style={{ color: 'var(--text-tertiary)' }}>编辑</div>
          <textarea className="w-full glass-light p-3 text-sm outline-none resize-none h-20 font-light rounded-xl" style={{ color: 'var(--text-primary)' }}
            value={editData.raw_content} onChange={e => setEditData({ ...editData, raw_content: e.target.value })} />
          <div className="mt-2">
            <label className="text-[10px] block mb-1" style={{ color: 'var(--text-tertiary)' }}>时间</label>
            <input type="datetime-local" className="w-full glass-light p-2 text-sm outline-none rounded-xl" style={{ color: 'var(--text-primary)' }}
              value={(() => { const d = new Date(editData.timeline_time); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); })()}
              onChange={e => { const v = e.target.value; if (v) { const d = new Date(v); setEditData({ ...editData, timeline_time: d.toISOString() }); } }} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input type="checkbox" id={'done-' + editData.id} className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent-400)' }}
              checked={editData.status === 'done'} onChange={e => setEditData({ ...editData, status: e.target.checked ? 'done' : 'pending' })} />
            <label htmlFor={'done-' + editData.id} className="text-xs select-none" style={{ color: 'var(--text-secondary)' }}>已完成</label>
          </div>
          <div className="flex gap-2 mt-2">
            <select className="flex-1 glass-light px-3 py-2 text-xs outline-none rounded-xl" style={{ color: 'var(--text-secondary)' }}
              value={editData.objective_id || ''} onChange={e => setEditData({ ...editData, objective_id: e.target.value || null })}>
              <option value="">不关联目标</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
            <select className="flex-1 glass-light px-3 py-2 text-xs outline-none rounded-xl" style={{ color: 'var(--text-secondary)' }}
              value={editData.type} onChange={e => setEditData({ ...editData, type: e.target.value })}>
              <option value="note">笔记</option><option value="todo">待办</option>
            </select>
          </div>
          {/* 关键节点 */}
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id={'kn-' + editData.id} className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent-400)', opacity: editData.objective_id ? 1 : 0.4 }}
                checked={editData.is_key_node || false} disabled={!editData.objective_id}
                onChange={e => {
                  if (!editData.objective_id) return;
                  const newKn = e.target.checked;
                  setEditData({ ...editData, is_key_node: newKn, ai_metadata: { ...editData.ai_metadata, progress_delta: newKn ? (editData.ai_metadata?.progress_delta || 1) : 0 } });
                }} />
              <label htmlFor={'kn-' + editData.id} className="text-xs select-none font-medium" style={{ color: editData.is_key_node ? 'var(--accent-500)' : 'var(--text-secondary)' }}>关键节点</label>
              {editData.is_key_node && <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>贡献目标进度</span>}
              {!editData.objective_id && <span className="text-[9px]" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>请先关联目标</span>}
            </div>
            {editData.is_key_node && editData.objective_id && (
              <div>
                <label className="text-[10px] block mb-1" style={{ color: 'var(--text-tertiary)' }}>贡献值 (progress_delta)</label>
                <input type="number" className="w-24 glass-light p-2 text-sm outline-none rounded-xl" style={{ color: 'var(--text-primary)' }}
                  value={editData.ai_metadata?.progress_delta || 0} min={0}
                  onChange={e => setEditData({ ...editData, ai_metadata: { ...editData.ai_metadata, progress_delta: parseInt(e.target.value) || 0 } })} />
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { onUpdate(event.id, editData); setEditing(false); }} className="flex-1 text-xs py-2 font-medium rounded-xl" style={{ backgroundColor: 'var(--accent-300)', color: 'var(--text-inverse)' }}>保存</button>
            <button onClick={() => setEditing(false)} className="flex-1 text-xs py-2 rounded-xl" style={{ color: 'var(--text-tertiary)' }}>取消</button>
            <button onClick={() => setShowDel(!showDel)} className="px-3 hover:text-red-400" style={{ color: 'var(--text-tertiary)' }}><Ic.Trash /></button>
          </div>
          {showDel && <button onClick={() => { onDelete(event.id); setEditing(false); }} className="w-full mt-2 bg-red-500/10 text-red-400 text-xs py-2 rounded-xl hover:bg-red-500/20">确认删除</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="group mb-6 cursor-pointer transition-all duration-300 hover:scale-[1.01]" onClick={() => setEditing(true)}>
      <div className="flex justify-center mb-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="p-4" style={{ background: '#fff', border: 'var(--border-card)', borderRadius: '12px', borderLeft: '2px solid ' + accent }}>
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)', fontFamily: '"SF Mono","Menlo","Cascadia Code",monospace' }}>{fmtTime(d)}</span>
          {obj && <span className="text-[9px] truncate max-w-[140px] font-medium" style={{ color: accent }}>{obj.title}</span>}
          {event.is_key_node && <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: accent + '20', color: accent }}>关键节点</span>}
          <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{TYPE_LABELS[event.type]}</span>
        </div>
        {/* Image preview */}
        {event.image_url && (
          <img src={event.image_url} className="rounded-lg w-full object-cover mb-2" style={{ maxHeight: 240 }} />
        )}
        <p className="text-lg leading-tight mb-1.5" style={{ color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '-0.01em' }}>{event.ai_metadata?.task_title || event.raw_content}</p>
        {(() => {
          const title = event.ai_metadata?.task_title || '';
          const raw = event.raw_content || '';
          const isDup = title.replace(/\s/g, '') === raw.replace(/\s/g, '');
          if (title && !isDup) {
            return (
              <p className="text-[13px] italic mb-1" style={{ color: 'var(--text-tertiary)', opacity: 0.45 }}>
                &ldquo;{raw.length > 50 ? raw.slice(0, 50) + '…' : raw}&rdquo;
                {(event.ai_metadata?.progress_delta || 0) > 0 && <span className="ml-1 font-medium not-italic" style={{ color: accent, opacity: 1 }}>+{event.ai_metadata.progress_delta}</span>}
              </p>
            );
          }
          return null;
        })()}
        {event.ai_metadata?.tags?.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{event.ai_metadata.tags.map((t, i) => <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--accent-100)', color: 'var(--accent-500)' }}>{t}</span>)}</div>}
        {pending && event.type === 'todo' && <button onClick={e => { e.stopPropagation(); onConfirm(event.id); }} className="mt-2 text-[10px] flex items-center gap-1 font-medium" style={{ color: 'var(--accent-400)' }}><Ic.Check /> 标记完成</button>}
        {event.status === 'done' && <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>已完成</span>}
      </div>
    </div>
  );
};
