import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventStore } from '@/hooks/useEvents';
import type { TimelineEvent } from '@/types/event';

interface HUDHeaderProps {
  exp: { done: number; total: number };
  isHeatmapOpen: boolean;
  onToggleHeatmap: () => void;
  events: TimelineEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  scrollY: Animated.Value;
  onExpandRequest: () => void;
}

const COLLAPSE_THRESHOLD = 60;
const OBJ_COUNT = 5;

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export function HUDHeader({
  exp,
  isHeatmapOpen,
  onToggleHeatmap,
  events,
  selectedDate,
  onSelectDate,
  scrollY,
  onExpandRequest,
}: HUDHeaderProps) {
  const insets = useSafeAreaInsets();
  const objectives = useEventStore((s) => s.objectives);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Calendar day stats
  const dayStats = useMemo(() => {
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

  const maxTodo = useMemo(() => {
    let m = 0;
    Object.values(dayStats).forEach((s) => { if (s.todo > m) m = s.todo; });
    return m;
  }, [dayStats]);

  const maxNote = useMemo(() => {
    let m = 0;
    Object.values(dayStats).forEach((s) => { if (s.note > m) m = s.note; });
    return m;
  }, [dayStats]);

  // ─── Animated interpolations ───
  const collapse = scrollY.interpolate({
    inputRange: [0, COLLAPSE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const expandedOpacity = collapse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.2, 0],
    extrapolate: 'clamp',
  });

  const expandedTranslateY = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
    extrapolate: 'clamp',
  });

  const collapsedOpacity = collapse.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerBgOpacity = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.94],
    extrapolate: 'clamp',
  });

  // ─── Objective circles ───
  const displayObjectives = objectives.slice(0, OBJ_COUNT);

  const renderSmallCircles = () =>
    displayObjectives.map((obj) => {
      const pct = obj.target > 0 ? obj.current / obj.target : 0;
      const w = pct * 24; // fill width within 24px circle
      return (
        <TouchableOpacity
          key={obj.id}
          activeOpacity={0.7}
          onPress={onExpandRequest}
          style={[styles.smallCircle, { borderColor: obj.color }]}
        >
          <View
            style={[
              styles.smallCircleFill,
              { backgroundColor: obj.color, width: w, height: w },
            ]}
          />
        </TouchableOpacity>
      );
    });

  const renderLargeCircles = () =>
    displayObjectives.map((obj) => {
      const pct = Math.round((obj.target > 0 ? obj.current / obj.target : 0) * 100);
      return (
        <View key={obj.id} style={styles.objCard}>
          <View style={[styles.objRing, { borderColor: obj.color }]}>
            <Text style={styles.objPct}>{pct}</Text>
          </View>
          <Text style={styles.objTitle} numberOfLines={1}>
            {obj.title}
          </Text>
          <Text style={[styles.objProgress, { fontFamily: MONO }]}>
            {obj.current}/{obj.target}
          </Text>
        </View>
      );
    });

  // ─── Calendar ───
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

  const titleRowContent = (
    <View style={styles.hudRow}>
      <Text style={styles.title}>
        川<Text style={styles.titleAccent}>上</Text>
      </Text>

      {/* Collapsed circles — between title and toggle */}
      <Animated.View
        style={[styles.collapsedRow, { opacity: collapsedOpacity }]}
      >
        <TouchableOpacity onPress={onExpandRequest} activeOpacity={0.7}>
          <View style={styles.collapsedCircles}>{renderSmallCircles()}</View>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity onPress={onToggleHeatmap}>
        <Text style={styles.toggleText}>
          {isHeatmapOpen ? '收起日历' : '展开日历'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 6 },
      ]}
    >
      <Animated.View
        style={[
          styles.bg,
          { opacity: headerBgOpacity },
        ]}
      />

      <View style={styles.content}>
        {/* Title row (always visible) */}
        {titleRowContent}

        {/* Expanded area: progress bar + large circles — slides up & fades */}
        <Animated.View
          style={{
            opacity: expandedOpacity,
            transform: [{ translateY: expandedTranslateY }],
          }}
        >
          {/* Progress bar */}
          <View style={styles.bars}>
            <View style={styles.barGroup}>
              <View style={styles.barLabel}>
                <Text style={[styles.barLabelText, { fontFamily: MONO }]}>今日任务</Text>
                <Text style={[styles.barValueTask, { fontFamily: MONO }]}>
                  {exp.done}/{exp.total}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    styles.barTask,
                    {
                      width: `${exp.total > 0 ? (exp.done / exp.total) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Large objective circles */}
          {displayObjectives.length > 0 && (
            <View style={styles.objectives}>{renderLargeCircles()}</View>
          )}
        </Animated.View>
      </View>

      {/* Heatmap dropdown */}
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
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>{renderCalendarDays()}</View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,240,235,0.96)',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  titleAccent: { color: '#8B7FB8', fontWeight: '300' },

  // Collapsed objective circles (in title row)
  collapsedRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedCircles: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  smallCircleFill: {
    position: 'absolute',
    borderRadius: 12,
  },

  toggleText: { fontSize: 12, color: '#8B84A0', fontWeight: '500' },

  // Progress bar
  bars: { marginTop: 4, marginBottom: 8 },
  barGroup: { gap: 4 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabelText: { fontSize: 10, color: '#8B84A0', textTransform: 'uppercase', letterSpacing: 1 },
  barValueTask: { fontSize: 10, color: '#8B7FB8' },
  barTrack: { height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  barTask: { backgroundColor: '#8B7FB8' },

  // Expanded objective circles
  objectives: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 4,
  },
  objCard: {
    alignItems: 'center',
    width: 56,
    gap: 4,
  },
  objRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  objTitle: {
    fontSize: 10,
    color: '#5C5670',
    maxWidth: 56,
    textAlign: 'center',
  },
  objProgress: {
    fontSize: 9,
    color: '#8B84A0',
  },

  // Heatmap calendar
  heatmap: {
    padding: 16,
    backgroundColor: 'rgba(245,240,235,0.98)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heatmapTitle: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  clearText: { fontSize: 11, color: '#8B84A0' },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
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
    borderWidth: 1.5,
    borderColor: '#8B7FB8',
    transform: [{ scale: 1.1 }],
  },
  calendarCellEmpty: { opacity: 0.4 },
  calendarText: { fontSize: 12, color: '#5C5670' },
  calendarTextSelected: { color: '#1a1a1a', fontWeight: '700' },
});
