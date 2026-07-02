import { useState, useMemo } from 'react';
import type { TimelineEvent } from '@/types/event';
import { tsDay as mkTsDay } from '@/lib/utils';

interface CalendarHeatmapProps {
  events: TimelineEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const levelColor = (count: number): string => {
  if (count === 0) return 'rgba(0,0,0,0.04)';
  if (count <= 2) return 'rgba(139,127,184,0.25)';
  if (count <= 5) return 'rgba(139,127,184,0.50)';
  return 'rgba(139,127,184,0.80)';
};

const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];

export const CalendarHeatmap = ({ events, selectedDate, onSelectDate }: CalendarHeatmapProps) => {
  const [expanded, setExpanded] = useState(false);
  const todayStrValue = useMemo(() => mkTsDay(new Date()), []);

  const dateMap = useMemo(() => {
    const m: Record<string, number> = {};
    events.forEach(ev => {
      const ds = mkTsDay(new Date(ev.record_time));
      m[ds] = (m[ds] || 0) + 1;
    });
    return m;
  }, [events]);

  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const start = new Date(end);
    start.setDate(start.getDate() - 83);

    const weeks: Array<Array<{ date: Date; ds: string; count: number }>> = [];
    let cur = new Date(start);
    cur.setDate(cur.getDate() - cur.getDay());

    while (cur <= end) {
      const week: Array<{ date: Date; ds: string; count: number }> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cur);
        const ds = mkTsDay(d);
        week.push({ date: d, ds, count: dateMap[ds] || 0 });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [dateMap]);

  // Collapsed: mini heat bar
  if (!expanded) {
    return (
      <div className="px-5 mb-2">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 w-full text-left bg-transparent border-0 p-0 cursor-pointer"
          type="button"
        >
          <span className="text-[11px] font-medium tracking-[0.02em] text-muted-foreground">
            活动热力图
          </span>
          <div className="flex gap-0.5 flex-1 justify-end">
            {weeks.slice(-6).map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => (
                  <div
                    key={di}
                    style={{
                      width: 10, height: 10, borderRadius: 2,
                      backgroundColor: levelColor(day.count),
                      outline: day.ds === todayStrValue ? '1.5px solid hsl(var(--primary))' : 'none',
                      outlineOffset: 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          {selectedDate && (
            <span
              onClick={e => { e.stopPropagation(); onSelectDate(null); }}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-primary cursor-pointer"
            >
              ✕ 清除
            </span>
          )}
        </button>
      </div>
    );
  }

  // Expanded: full heatmap
  return (
    <div
      className="px-5 py-3 mb-2 mx-3"
      style={{ background: '#fff', borderRadius: 14, border: '0.5px solid hsl(var(--border))' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-foreground">活动热力图</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-[11px] text-muted-foreground bg-transparent border-0 cursor-pointer"
        >
          收起
        </button>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-1 mb-3 justify-end">
        <span className="text-[9px] text-muted-foreground mr-1">少</span>
        {[0, 1, 3, 6].map(n => (
          <div key={n} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: levelColor(n) }} />
        ))}
        <span className="text-[9px] text-muted-foreground ml-1">多</span>
      </div>

      {/* 网格 */}
      <div className="flex justify-center">
        <div className="flex gap-1">
          <div className="flex flex-col gap-0.5 mr-1 pt-0.5">
            {dayLabels.map((l, i) => (
              <span
                key={i}
                className="text-[9px] text-muted-foreground opacity-50 w-3.5 text-right leading-[14px]"
              >
                {l}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <button
                  key={di}
                  type="button"
                  onClick={() => onSelectDate(day.ds === selectedDate ? null : day.ds)}
                  title={`${day.ds}: ${day.count} 条记录`}
                  style={{
                    width: 14, height: 14, borderRadius: 3,
                    backgroundColor: levelColor(day.count),
                    border: day.ds === todayStrValue ? '1.5px solid hsl(var(--primary))' : '1.5px solid transparent',
                    outline: day.ds === selectedDate ? '2px solid hsl(var(--primary))' : 'none',
                    outlineOffset: 2,
                    cursor: day.count > 0 || day.ds === todayStrValue ? 'pointer' : 'default',
                    padding: 0,
                    transition: 'transform 0.15s',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {selectedDate && (
        <div className="text-center mt-2">
          <span className="text-[11px] text-primary">
            {selectedDate} · {dateMap[selectedDate] || 0} 条记录
          </span>
        </div>
      )}
    </div>
  );
};
