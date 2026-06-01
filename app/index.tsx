import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  Animated,
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
  const scrollY = useRef(new Animated.Value(0)).current;

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

  const exp = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTodos = events.filter(
      (e) => e.type === 'todo' && new Date(e.timeline_time) >= today
    );
    const done = todayTodos.filter((e) => e.status === 'done').length;
    return { done, total: todayTodos.length };
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

  const handleExpandRequest = () => {
    // Scroll to top to expand collapsed header
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
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
    [...filteredFuture].forEach((e) => {
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
        exp={exp}
        isHeatmapOpen={isHeatmapOpen}
        onToggleHeatmap={() => setIsHeatmapOpen(!isHeatmapOpen)}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        scrollY={scrollY}
        onExpandRequest={handleExpandRequest}
      />

      {/* Bi-directional Feed */}
      <Animated.FlatList
        ref={listRef as any}
        data={flatData}
        keyExtractor={(item, i) =>
          item.type === 'event' && item.event ? item.event.id : `${item.type}-${i}`
        }
        renderItem={renderFlatItem}
        contentContainerStyle={{
          paddingTop: insets.top + 190,
          paddingBottom: 120,
          paddingHorizontal: 16,
        }}
        style={styles.feed}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
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
  container: { flex: 1, backgroundColor: '#F5F0EB' },
  bg: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#F5F0EB',
  },
  feed: { flex: 1 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    opacity: 0.8,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(0,0,0,0.06)' },
  dividerPill: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 16,
  },
  dividerText: { fontSize: 10, color: '#8B84A0', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  nowMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 32,
    opacity: 0.9,
  },
  nowLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(0,0,0,0.08)' },
  nowPill: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 16,
  },
  nowText: {
    fontSize: 11,
    color: '#1a1a1a',
    fontWeight: '600',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: '#8B84A0', fontSize: 15 },
  emptySubtext: { color: '#8B84A0', fontSize: 13, marginTop: 4 },
  footer: { alignItems: 'center', paddingVertical: 40 },
  footerText: { color: '#8B84A0', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
