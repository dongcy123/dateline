// ==========================================
// ObjEditor — 目標編輯彈窗
// ==========================================
window.Kawa = window.Kawa || {};

window.Kawa.ObjEditor = ({ objective, onSave, onClose }) => {
  const [title, setTitle] = React.useState(objective?.title || '');
  const [target, setTarget] = React.useState(objective?.target || 100);
  const [current, setCurrent] = React.useState(objective?.current || 0);
  const [color, setColor] = React.useState(objective?.color || window.Kawa.OBJ_PALETTE[0]);
  const isNew = !objective;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[320px] p-5 space-y-4 animate-fade-in rounded-2xl" onClick={e => e.stopPropagation()} style={{ background: '#fff', border: 'var(--border-card-hover)' }}>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{isNew ? '新建目标' : '编辑目标'}</h3>
        <input className="w-full glass-light p-2.5 text-sm outline-none font-light rounded-xl" style={{ color: 'var(--text-primary)' }} placeholder="目标名称" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        <div className="flex gap-3">
          <div className="flex-1"><label className="text-[10px] block mb-1" style={{ color: 'var(--text-tertiary)' }}>目标值</label><input type="number" className="w-full glass-light p-2 text-sm outline-none rounded-xl" style={{ color: 'var(--text-primary)' }} value={target} onChange={e => setTarget(parseInt(e.target.value) || 0)} /></div>
          <div className="flex-1"><label className="text-[10px] block mb-1" style={{ color: 'var(--text-tertiary)' }}>当前进度</label><input type="number" className="w-full glass-light p-2 text-sm outline-none rounded-xl" style={{ color: 'var(--text-primary)' }} value={current} onChange={e => setCurrent(parseInt(e.target.value) || 0)} /></div>
        </div>
        <div><label className="text-[10px] block mb-1" style={{ color: 'var(--text-tertiary)' }}>主题色</label><div className="flex gap-2 flex-wrap">{window.Kawa.OBJ_PALETTE.map(c => <button key={c} className={'w-7 h-7 rounded-full transition-transform ' + (color === c ? 'scale-125 ring-1' : '')} style={{ backgroundColor: c, ...(color === c ? { boxShadow: '0 0 0 2px var(--accent-400)' } : {}) }} onClick={() => setColor(c)} />)}</div></div>
        <div className="flex gap-2 pt-2">
          <button className="flex-1 text-xs py-2.5 font-medium rounded-xl" style={{ backgroundColor: 'var(--accent-300)', color: 'var(--text-inverse)' }} onClick={() => { if (title.trim()) onSave({ title: title.trim(), target, current, color }); }}>{isNew ? '创建' : '保存'}</button>
          <button className="flex-1 text-xs py-2.5 rounded-xl" style={{ color: 'var(--text-tertiary)' }} onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
};
