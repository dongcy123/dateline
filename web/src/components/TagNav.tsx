import type { Objective } from '@/types/event';
import { Button } from '@/components/ui/button';

interface TagNavProps {
  objectives: Objective[];
  activeTag: string | null;
  onChange: (id: string | null) => void;
}

export const TagNav = ({ objectives, activeTag, onChange }: TagNavProps) => {
  const allTags = [{ id: null as string | null, title: '全部', color: '#8B84A0' }, ...objectives];

  return (
    <div className="overflow-x-auto no-scrollbar px-5 mb-4">
      <div className="flex gap-2 py-1">
        {allTags.map(tag => (
          <Button
            key={tag.id || 'all'}
            variant="ghost"
            size="sm"
            onClick={() => onChange(tag.id)}
            className="flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-all duration-200 h-auto"
            style={{
              backgroundColor: activeTag === tag.id ? (tag.color + '20') : 'transparent',
              color: activeTag === tag.id ? tag.color : 'hsl(var(--muted-foreground))',
              border: activeTag === tag.id ? `1px solid ${tag.color}40` : '1px solid transparent',
            }}
          >
            {tag.title}
          </Button>
        ))}
      </div>
    </div>
  );
};
