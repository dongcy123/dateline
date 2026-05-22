import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TimelineEvent } from '@/types/event';

interface HUDHeaderProps {
  exp: { done: number; total: number };
  isHeatmapOpen: boolean;
  onToggleHeatmap: () => void;
  events: TimelineEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function HUDHeader({
  exp,
  isHeatmapOpen,
  onToggleHeatmap,
  events,
  selectedDate,
  onSelectDate,
}: HUDHeaderProps) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Aggregate day stats
  const dayStats = React.useMemo(() => {
    const stats: Record<number, { todo: number; note: number }> = {};
    events.forEach((e) => {
      const d = new Date(e.timeline_time);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate();
        if (!stats[key]) stats[key] = { todo: 0, note: 0 };
        if (e.type === 'todo') stats[key].todo += 1;
        else if (e.type === 'note') stats[key].note += 1;
      }
    });
    return stats;
  }, [events, year, month]);

  let maxTodo = 0, maxNote = 0;
  Object.values(dayStats).forEach((s) => {
    if (s.todo > maxTodo) maxTodo = s.todo;
    if (s.note > maxNote) maxNote = s.note;
  });

  const renderCalendarDays = () => {
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calendarCell} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const s = dayStats[d] || { todo: 0, note: 0 };
      const wTodo = maxTodo ? Math.min(s.todo / maxTodo, 1) : 0;
      const wNote = maxNote ? Math.min(s.note / maxNote, 1) : 0;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = selectedDate === dateStr;
      const hasData = wTodo > 0 || wNote > 0;

      cells.push(
        <TouchableOpacity
          key={d}
          onPress={() => onSelectDate(isSelected ? null : dateStr)}
          style={[
            styles.calendarCell,
            isSelected && styles.calendarCellSelected,
            !hasData && !isSelected && styles.calendarCellEmpty,
          ]}
        >
          <Text style={[styles.calendarText, isSelected && styles.calendarTextSelected]}>
            {d}
          </Text>
        </TouchableOpacity>
      );
    }
    return cells;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* HUD Bar */}
      <View style={styles.hud}>
        <View style={styles.hudRow}>
          <Text style={styles.title}>
            流水<Text style={styles.titleAccent}>账</Text>
          </Text>
          <TouchableOpacity onPress={onToggleHeatmap}>
            <Text style={styles.toggleText}>
              {isHeatmapOpen ? '收起日历' : '展开日历'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Task bar */}
        <View style={styles.bars}>
          <View style={styles.barGroup}>
            <View style={styles.barLabel}>
              <Text style={styles.barLabelText}>今日任务</Text>
              <Text style={styles.barValueTask}>
                {exp.done} / {exp.total}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  styles.barTask,
                  { width: `${(exp.done / exp.total) * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Heatmap Dropdown */}
      {isHeatmapOpen && (
        <View style={styles.heatmap}>
          <View style={styles.heatmapHeader}>
            <Text style={styles.heatmapTitle}>
              {year}年 {month + 1}月
            </Text>
            {selectedDate && (
              <TouchableOpacity onPress={() => onSelectDate(null)}>
                <Text style={styles.clearText}>清除筛选</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.weekdayRow}>
            {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
              <Text key={d} style={styles.weekday}>{d}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>{renderCalendarDays()}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.60)',
    shadowColor: '#8B7FB8',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  hud: { paddingHorizontal: 16, paddingBottom: 12 },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#2D2838' },
  titleAccent: { color: '#8B7FB8' },
  toggleText: { fontSize: 13, color: '#8B84A0' },
  bars: { gap: 8 },
  barGroup: { gap: 4 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabelText: { fontSize: 11, color: '#8B84A0' },
  barValue: { fontSize: 11, color: '#8B7FB8' },
  barValueTask: { fontSize: 11, color: '#8B7FB8' },
  barTrack: { height: 6, backgroundColor: '#EDE7E0', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barBudget: { backgroundColor: '#8B7FB8' },
  barTask: { backgroundColor: '#B8B5E0' },
  heatmap: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.40)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.30)',
  },
  heatmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heatmapTitle: { fontSize: 13, color: '#2D2838' },
  clearText: { fontSize: 11, color: '#8B84A0' },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  weekday: { fontSize: 10, color: '#8B84A0', textAlign: 'center', width: 32 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calendarCell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellSelected: {
    borderWidth: 2,
    borderColor: '#B8B5E0',
    transform: [{ scale: 1.1 }],
  },
  calendarCellEmpty: { opacity: 0.4 },
  calendarText: { fontSize: 12, color: '#5C5670' },
  calendarTextSelected: { color: '#2D2838', fontWeight: '700' },
});
