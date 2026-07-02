import type { TimelineEvent, Objective } from '@/types/event';
import { Badge } from '@/components/ui/badge';

interface MasonryCardProps {
  card: TimelineEvent;
  objectives: Objective[];
  relativeTime: (iso: string) => string;
  onOpen: (card: TimelineEvent) => void;
  onComplete?: (id: string) => void;
}

const STICKY = [
  { bg: '#FFFBE6', border: '#EEDD66', dot: '#E5C800' },
  { bg: '#FFF0F0', border: '#E8A0A0', dot: '#D46868' },
  { bg: '#E8F6E8', border: '#90C890', dot: '#5EA85E' },
  { bg: '#F0EAFF', border: '#C0B0E8', dot: '#8B6FC0' },
];

export const MasonryCard = ({ card, objectives, relativeTime, onOpen, onComplete }: MasonryCardProps) => {
  const obj = objectives.find(o => o.id === card.objective_id);
  const title = card.ai_metadata?.task_title || card.raw_content?.slice(0, 20) || '';
  const body = card.raw_content || '';
  const hasImg = !!(card.ai_metadata as { images?: string[] } | undefined)?.images?.length || (card as { image_url?: string }).image_url;
  const isTodo = card.type === 'todo';
  const isDone = card.status === 'done';

  const titleNorm = title.replace(/\s/g, '');
  const bodyNorm = body.replace(/\s/g, '');
  const showBody = !isTodo && body && titleNorm !== bodyNorm;

  const stickyIdx = isTodo ? card.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % STICKY.length : 0;
  const sc = STICKY[stickyIdx];

  // 待办卡：紧凑便利贴 + 圆形完成按钮
  if (isTodo) {
    return (
      <div
        className="transition-all duration-200 cursor-pointer active:scale-[0.97] w-full"
        onClick={() => onOpen(card)}
        style={{ opacity: isDone ? 0.45 : 1 }}
      >
        <div
          style={{
            background: sc.bg,
            border: `1px solid ${sc.border}`,
            borderRadius: '12px',
            padding: '10px 12px',
            boxShadow: `0 1px 4px ${sc.border}25`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: sc.dot, opacity: 0.25 }} />

          {/* 圆圈完成按钮 — 与 Top3Focus 完全一致 */}
          <button
            type="button"
            className="absolute top-2 right-2 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200 active:scale-90 z-10"
            style={{ border: `2px solid ${sc.border}`, backgroundColor: 'rgba(255,255,255,0.7)' }}
            onClick={e => { e.stopPropagation(); if (onComplete) onComplete(card.id); }}
            title="标记完成"
          />

          <p style={{
            fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 6,
            textDecoration: isDone ? 'line-through' : 'none',
            letterSpacing: '-0.01em', wordBreak: 'break-word', paddingRight: 24,
          }}>
            {title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            {obj ? (
              <Badge variant="outline" className="text-[9px] font-medium" style={{ backgroundColor: obj.color + '14', color: obj.color, border: 0 }}>
                {obj.title}
              </Badge>
            ) : <span />}
            <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))', opacity: 0.6, whiteSpace: 'nowrap' }}>
              {relativeTime(card.record_time)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 笔记卡：Ins 风宽大文章卡
  const accentColor = obj?.color || '#D4D4D4';
  const allImages: string[] = (card.ai_metadata as { images?: string[] })?.images || ((card as { image_url?: string }).image_url ? [(card as { image_url?: string }).image_url!] : []);
  const showImg = allImages.length > 0;
  const extraCount = allImages.length - 1;

  return (
    <div
      className="transition-all duration-200 cursor-pointer active:scale-[0.98]"
      onClick={() => onOpen(card)}
      style={{
        background: '#fff',
        border: '0.5px solid hsl(var(--border))',
        borderRadius: '16px',
        opacity: isDone ? 0.5 : 1,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: showImg ? '0 2px 12px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      {!showImg && (
        <div style={{
          position: 'absolute', left: 0, top: 12, bottom: 12,
          width: 3, borderRadius: '0 3px 3px 0', background: accentColor, opacity: 0.5,
        }} />
      )}

      {showImg && (
        <div style={{ position: 'relative' }}>
          <img src={allImages[0]} alt={title}
            style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 240 }}
            loading="lazy"
          />
          {extraCount > 0 && (
            <span style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
            }}>+{extraCount}</span>
          )}
        </div>
      )}

      <div style={{ padding: hasImg ? '14px 16px 14px' : '16px 16px 14px 20px' }}>
        <p style={{
          fontSize: hasImg ? 15 : 17, fontWeight: 700, lineHeight: 1.35,
          marginBottom: showBody ? 8 : 0,
          textDecoration: isDone ? 'line-through' : 'none',
          letterSpacing: '-0.015em', wordBreak: 'break-word',
        }}>
          {title}
        </p>
        {showBody && (
          <p style={{
            fontSize: 13, lineHeight: 1.65, display: '-webkit-box',
            WebkitLineClamp: 5, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', marginBottom: 10, wordBreak: 'break-word',
          }}>
            {body}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: showBody ? 0 : 4 }}>
          <Badge variant="secondary" className="text-[10px]">笔记</Badge>
          {obj && (
            <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: obj.color + '14', color: obj.color, border: 0 }}>
              {obj.title}
            </Badge>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', opacity: 0.6, whiteSpace: 'nowrap' }}>
            {relativeTime(card.record_time)}
          </span>
        </div>
      </div>
    </div>
  );
};
