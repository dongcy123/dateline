import { useState, useEffect } from 'react';
import type { TimelineEvent, Objective } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtDate } from '@/lib/utils';

interface CardDetailProps {
  card: TimelineEvent;
  objectives: Objective[];
  onClose: () => void;
  onSave: (id: string, data: TimelineEvent) => void;
  onDelete: (id: string) => void;
}

export const CardDetail = ({ card, objectives, onClose, onSave, onDelete }: CardDetailProps) => {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<TimelineEvent>(card);
  const [showDel, setShowDel] = useState(false);

  const obj = objectives.find(o => o.id === editData.objective_id);
  const isPinned = !!(card.ai_metadata as { pinned_at?: string })?.pinned_at;
  const title = card.ai_metadata?.task_title || card.raw_content?.slice(0, 20) || '';
  const isTodo = card.type === 'todo';
  const isDone = card.status === 'done';

  const diffMs = Date.now() - new Date(card.record_time).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  let relTime: string;
  if (diffMins < 1) relTime = '刚刚';
  else if (diffMins < 60) relTime = diffMins + '分钟前';
  else if (diffHrs < 24) relTime = diffHrs + '小时前';
  else if (diffDays === 1) relTime = '昨天';
  else if (diffDays < 7) relTime = diffDays + '天前';
  else relTime = fmtDate(new Date(card.record_time));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePin = () => {
    const newMeta: Record<string, unknown> = { ...card.ai_metadata };
    if (isPinned) { delete newMeta.pinned_at; }
    else { newMeta.pinned_at = new Date().toISOString(); }
    onSave(card.id, { ...card, ai_metadata: newMeta as TimelineEvent['ai_metadata'] });
  };

  const allImgs: string[] = ((card.ai_metadata as { images?: string[] })?.images) || ((card as { image_url?: string }).image_url ? [(card as { image_url?: string }).image_url!] : []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(14px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg mx-auto flex flex-col overflow-hidden animate-fade-in"
        style={{ background: '#fff', borderRadius: 20, maxHeight: '85vh', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      >
        {/* 顶部栏 */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" onClick={onClose}>✕</Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-base"
            style={{ background: isPinned ? 'hsl(var(--secondary))' : 'hsl(var(--muted))' }}
            onClick={handlePin}>
            {isPinned ? '📌' : '📍'}
          </Button>
          {!editing && <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground" onClick={() => setEditing(true)}>✎</Button>}
        </div>

        {/* 滚动内容 */}
        <div className="overflow-y-auto no-scrollbar flex-1">
          {/* 图片展示 */}
          {allImgs.length === 1 && <img src={allImgs[0]} alt={title} style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '50vh' }} />}
          {allImgs.length > 1 && (
            <div className="overflow-x-auto no-scrollbar flex gap-1 px-1">
              {allImgs.map((url, i) => <img key={i} src={url} alt={title} style={{ height: '40vh', width: 'auto', flexShrink: 0, borderRadius: 4, objectFit: 'cover' }} />)}
            </div>
          )}

          <div style={{ padding: '20px 20px 16px' }}>
            {/* 标题 */}
            {editing ? (
              <Input value={editData.ai_metadata?.task_title || ''}
                onChange={e => setEditData({ ...editData, ai_metadata: { ...editData.ai_metadata, task_title: e.target.value } })}
                placeholder="标题" className="text-[22px] font-bold mb-3 tracking-[-0.01em]" />
            ) : (
              <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 12,
                textDecoration: isDone ? 'line-through' : 'none' }}>{title}</h2>
            )}

            {/* 正文 */}
            {editing ? (
              <Textarea value={editData.raw_content || ''}
                onChange={e => setEditData({ ...editData, raw_content: e.target.value })}
                rows={6} placeholder="正文内容" className="mb-3 min-h-[100px] leading-relaxed" />
            ) : (
              card.raw_content && <p style={{ fontSize: 15, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12 }}>
                {card.raw_content}
              </p>
            )}

            {/* 属性行 */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isTodo ? 'bg-red-50 text-destructive' : 'bg-secondary text-primary'}`}>
                {isTodo ? '待办' : '笔记'}
              </span>
              {isDone && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(126,184,160,0.12)', color: 'hsl(var(--color-success))' }}>✓ 已完成</span>}
              {obj && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: obj.color + '14', color: obj.color }}>{obj.title}</span>}
              <div className="flex-1 min-w-1" />
              <span className="text-[11px] text-muted-foreground opacity-70 whitespace-nowrap">{relTime}</span>
            </div>

            {/* 编辑模式额外字段 */}
            {editing && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <Select value={editData.type} onValueChange={v => setEditData({ ...editData, type: v as TimelineEvent['type'] })}>
                    <SelectTrigger className="flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="note">笔记</SelectItem><SelectItem value="todo">待办</SelectItem></SelectContent>
                  </Select>
                  <Select value={editData.objective_id || '_none'} onValueChange={v => setEditData({ ...editData, objective_id: v === '_none' ? undefined : v })}>
                    <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="不关联目标" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">不关联目标</SelectItem>
                      {objectives.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 items-center">
                  <Input type="datetime-local" className="flex-1 text-xs"
                    value={(() => { const d = new Date(editData.timeline_time); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
                    onChange={e => { const v = e.target.value; if (v) setEditData({ ...editData, timeline_time: new Date(v).toISOString() }); }} />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <Checkbox checked={editData.status === 'done'}
                      onCheckedChange={c => setEditData({ ...editData, status: c ? 'done' : 'pending' })} /> 已完成
                  </label>
                </div>
                {editData.objective_id && (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={editData.is_key_node || false}
                      onCheckedChange={c => setEditData({ ...editData, is_key_node: !!c, ai_metadata: { ...editData.ai_metadata, progress_delta: c ? (editData.ai_metadata?.progress_delta || 1) : 0 } })} /> 关键节点 · 贡献进度
                  </label>
                )}
                <div className="flex gap-2.5 pt-2">
                  <Button variant="outline" className="flex-1 text-xs rounded-xl" onClick={() => { setEditing(false); setEditData(card); }}>取消</Button>
                  <Button className="flex-1 text-xs rounded-xl" onClick={() => { onSave(card.id, editData); setEditing(false); }}>保存</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部删除 */}
        {!editing && (
          <div className="flex-shrink-0 px-4 pb-4 pt-1">
            {showDel ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-xs rounded-xl" onClick={() => setShowDel(false)}>取消</Button>
                <Button variant="destructive" className="flex-1 text-xs rounded-xl" onClick={() => { onDelete(card.id); onClose(); }}>确认删除</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full text-xs rounded-xl text-muted-foreground" onClick={() => setShowDel(true)}>删除</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
