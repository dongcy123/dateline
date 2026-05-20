import { create } from 'zustand';
import type { TimelineEvent } from '@/types/event';
import { supabase } from '@/services/supabase';

interface EventStore {
  events: TimelineEvent[];
  loading: boolean;
  error: string | null;
  loadEvents: () => Promise<void>;
  addEvent: (event: TimelineEvent) => Promise<void>;
  confirmEvent: (id: string) => Promise<void>;
  updateEvent: (id: string, updates: Partial<TimelineEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  loading: false,
  error: null,

  loadEvents: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('timeline_events')
      .select('*')
      .order('timeline_time', { ascending: false });

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ events: data as TimelineEvent[], loading: false });
  },

  addEvent: async (event) => {
    set((s) => ({ events: [event, ...s.events] }));
    const { error } = await supabase.from('timeline_events').insert(event);
    if (error) console.error('Failed to persist event:', error.message);
  },

  confirmEvent: async (id) => {
    set((s) => ({
      events: s.events.map((e) =>
        e.id === id
          ? { ...e, status: e.type === 'todo' ? 'confirmed' as const : 'done' as const }
          : e
      ),
    }));
    const event = get().events.find((e) => e.id === id);
    if (event) {
      await supabase
        .from('timeline_events')
        .update({ status: event.status })
        .eq('id', id);
    }
  },

  updateEvent: async (id, updates) => {
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
    await supabase.from('timeline_events').update(updates).eq('id', id);
  },

  deleteEvent: async (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    await supabase.from('timeline_events').delete().eq('id', id);
  },
}));
