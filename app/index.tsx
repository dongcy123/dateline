import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HUDHeader } from '@/components/HUDHeader';
import { EventCard } from '@/components/EventCard';
import { Omnibox } from '@/components/Omnibox';
import { useEventStore } from '@/hooks/useEvents';
import { processWithAI } from '@/services/aiProxy';
import { getUserError } from '@/lib/errors';
import type { TimelineEvent } from '@/types/event';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { events, loading, error, loadEvents, addEvent, confirmEvent, updateEvent, deleteEvent } = useEventStore();
  const [isHeatmapOpen, setIsHeatmapOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  // If no Supabase configured, use mock data for demo
  useEffect(() => {
    if (!loading && events.length === 0 && !error) {
      // Likely no Supabase configured — skip auto-populate for now
    }
  }, [loading, events, error]);

  const now = new Date();
  const nowStr = now.toISOString();

  const futureEvents = useMemo(
    () => events.filter((e) => e.timeline_time > nowStr),
    [events, nowStr]
  );
  const pastEvents = useMemo(
    () => events.filter((e) => e.timeline_time <= nowStr),
    [events, nowStr]
  );

  const budget = useMemo(() => {
    const spent = events
      .filter((e) => e.type === 'expense' && e.status !== 'pending')
      .reduce((sum, e) => sum + ((e.ai_metadata as any)?.amount || 0), 0);
    return { remain: Math.max(5000 - spent, 0), total: 5000 };
  }, [events]);

  const exp = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTodos = events.filter(
      (e) => e.type === 'todo' && new Date(e.timeline_time) >= today
    );
    const done = todayTodos.filter((e) => e.status === 'done').length;
    return { done, total: todayTodos.length || 5 };
  }, [events]);

  // Filter events by selected date
  const filteredPast = useMemo(() => {
    if (!selectedDate) return pastEvents;
    return pastEvents.filter((e) => {
      const d = new Date(e.timeline_time);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return ds === selectedDate;
    });
  }, [pastEvents, selectedDate]);

  const filteredFuture = useMemo(() => {
    if (!selectedDate) return futureEvents;
    return futureEvents.filter((e) => {
      const d = new Date(e.timeline_time);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return ds === selectedDate;
    });
  }, [futureEvents, selectedDate]);

  const handleTextSubmit = async (text: string) => {
    setIsProcessing(true);
    try {
      const event = await processWithAI({ text, engine: 'text' });
      await addEvent(event);
      // Scroll to NOW marker
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 300);
    } catch (err: any) {
      const ue = getUserError(err?.code || 'unknown');
      Alert.alert(ue.problem, `${ue.cause}\n\n${ue.fix}`, [
        { text: ue.action || '知道了' },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraPress = () => {
    // TODO: Launch camera/image picker → upload to Supabase Storage → call vision AI
    Alert.alert('相机', '拍照功能将在下一步实现');
  };

  const handleMicPress = () => {
    // TODO: Launch native speech-to-text → feed text to AI proxy
    Alert.alert('语音', '语音输入功能将在下一步实现');
  };

  const renderDateDivider = (dateStr: string) => (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerPill}>
        <Text style={styles.dividerText}>{dateStr}</Text>
      </View>
      <View style={styles.dividerLine} />
    </View>
  );

  const renderItem = ({ item }: { item: TimelineEvent }) => {
    const d = new Date(item.timeline_time);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return (
      <View>
        <EventCard
          event={item}
          onConfirm={confirmEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
        />
      </View>
    );
  };

  const NowMarker = () => (
    <View style={styles.nowMarker}>
      <View style={styles.nowLine} />
      <View style={styles.nowPill}>
        <Text style={styles.nowText}>现在</Text>
      </View>
      <View style={styles.nowLine} />
    </View>
  );

  // Build flattened list with date dividers
  const flatData = useMemo(() => {
    const items: Array<{ type: 'event' | 'divider' | 'now'; event?: TimelineEvent; date?: string }> = [];

    // Future events (shown above NOW)
    let lastDate = '';
    [...filteredFuture].reverse().forEach((e) => {
      const d = new Date(e.timeline_time);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (ds !== lastDate) {
        items.push({ type: 'divider', date: ds });
        lastDate = ds;
      }
      items.push({ type: 'event', event: e });
    });

    items.push({ type: 'now' });

    // Past events (shown below NOW)
    lastDate = '';
    filteredPast.forEach((e) => {
      const d = new Date(e.timeline_time);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (ds !== lastDate) {
        items.push({ type: 'divider', date: ds });
        lastDate = ds;
      }
      items.push({ type: 'event', event: e });
    });

    return items;
  }, [filteredFuture, filteredPast]);

  const renderFlatItem = ({ item }: { item: typeof flatData[number] }) => {
    if (item.type === 'now') return <NowMarker />;
    if (item.type === 'divider') return renderDateDivider(item.date!);
    if (item.type === 'event' && item.event)
      return (
        <EventCard
          event={item.event}
          onConfirm={confirmEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
        />
      );
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Background gradient layer */}
      <View style={styles.bg} />

      {/* HUD Header */}
      <HUDHeader
        budget={budget}
        exp={exp}
        isHeatmapOpen={isHeatmapOpen}
        onToggleHeatmap={() => setIsHeatmapOpen(!isHeatmapOpen)}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* Bi-directional Feed */}
      <FlatList
        ref={listRef}
        data={flatData}
        keyExtractor={(item, i) =>
          item.type === 'event' && item.event ? item.event.id : `${item.type}-${i}`
        }
        renderItem={renderFlatItem}
        contentContainerStyle={{
          paddingTop: insets.top + 140,
          paddingBottom: 120,
          paddingHorizontal: 16,
        }}
        style={styles.feed}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>还没有记录</Text>
            <Text style={styles.emptySubtext}>在底部输入框开始记录吧</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerText}>-- 达到时间轴边界 --</Text>
          </View>
        }
      />

      {/* Omnibox */}
      <Omnibox
        onSubmitText={handleTextSubmit}
        onCameraPress={handleCameraPress}
        onMicPress={handleMicPress}
        isProcessing={isProcessing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  bg: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#09090b',
  },
  feed: { flex: 1 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    opacity: 0.8,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(39,39,42,0.5)' },
  dividerPill: {
    backgroundColor: 'rgba(24,24,27,0.5)',
    borderWidth: 0.5,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 16,
  },
  dividerText: { fontSize: 10, color: '#71717a', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  nowMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 32,
    opacity: 0.9,
  },
  nowLine: { flex: 1, height: 0.5, backgroundColor: '#3f3f46' },
  nowPill: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(59,130,246,0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  nowText: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: '#71717a', fontSize: 15 },
  emptySubtext: { color: '#52525b', fontSize: 13, marginTop: 4 },
  footer: { alignItems: 'center', paddingVertical: 40 },
  footerText: { color: '#3f3f46', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
