import { create } from 'zustand';
import type { TimelineEvent, Objective } from '@/types/event';

const EV_KEY = 'kw_events_v3';
const OBJ_KEY = 'kw_obj_v3';

// FrsionOS 薰衣草色板
const OBJ_PALETTE = [
  '#8B7FB8','#A89FCD','#C48080','#7EB8A0','#B8A080','#8090B8','#A080B0','#6B5E9A',
  '#9B8FC0','#C89090','#88B8A8','#B89088','#8898B8','#9888B0','#7B6EA0',
];

const MOCK_OBJS: Objective[] = [];

// Supabase 客户端 (按需初始化)
let sb: any = null;
const SB_URL = 'https://gduqrtzoggpjyifxvzxy.supabase.co';
const SB_KEY = 'sb_publishable_8q1OXyDCIo6wcn82ReOa4w_-3azo0lH';

function getSB() {
  if (sb) return sb;
  try {
    const { createClient } = require('@supabase/supabase-js');
    sb = createClient(SB_URL, SB_KEY);
  } catch { /* Supabase SDK not available */ }
  return sb;
}

let AsyncStorage: any = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch {}

async function load(key: string, fallback: any) {
  try {
    if (AsyncStorage) { const r = await AsyncStorage.getItem(key); if (r) return JSON.parse(r); }
    if (typeof localStorage !== 'undefined') { const r = localStorage.getItem(key); if (r) return JSON.parse(r); }
  } catch {}
  return fallback;
}

async function persist(key: string, data: any) {
  try {
    const raw = JSON.stringify(data);
    if (AsyncStorage) await AsyncStorage.setItem(key, raw);
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, raw);
  } catch {}
}

async function syncToSB(table: string, data: any) {
  const client = getSB();
  if (!client) return;
  try {
    const { error } = await client.from(table).upsert(data);
    if (error) console.warn(`[SB] ${table}:`, error.message);
  } catch(e) { console.warn(`[SB] ${table} error:`, (e as Error).message); }
}

async function deleteFromSB(table: string, id: string) {
  const client = getSB();
  if (!client) return;
  try {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) console.warn(`[SB] delete ${table}:`, error.message);
  } catch(e) { console.warn(`[SB] delete ${table} error:`, (e as Error).message); }
}

async function loadFromSB() {
  const client = getSB();
  if (!client) return null;
  try {
    const [evRes, objRes] = await Promise.all([
      client.from('timeline_events').select('*').order('timeline_time', { ascending: false }),
      client.from('objectives').select('*').order('created_at', { ascending: true })
    ]);
    return {
      events: (evRes.data || []) as TimelineEvent[],
      objectives: (objRes.data || []) as Objective[]
    };
  } catch { return null; }
}

interface EventStore {
  events: TimelineEvent[];
  objectives: Objective[];
  loading: boolean;
  error: string | null;
  loadEvents: () => Promise<void>;
  addEvent: (event: TimelineEvent) => Promise<void>;
  confirmEvent: (id: string) => Promise<void>;
  updateEvent: (id: string, u: Partial<TimelineEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addObjective: (o: Objective) => Promise<void>;
  updateObjective: (id: string, u: Partial<Objective>) => Promise<void>;
  deleteObjective: (id: string) => Promise<void>;
  addProgress: (objId: string, delta: number) => Promise<void>;
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  objectives: MOCK_OBJS,
  loading: false,
  error: null,

  loadEvents: async () => {
    set({ loading: true });
    // Try Supabase first
    const remote = await loadFromSB();
    if (remote && remote.events.length > 0) {
      set({ events: remote.events, objectives: remote.objectives.length > 0 ? remote.objectives : MOCK_OBJS, loading: false });
      persist(EV_KEY, remote.events);
      persist(OBJ_KEY, remote.objectives.length > 0 ? remote.objectives : MOCK_OBJS);
      return;
    }
    // Fallback to local
    const events = await load(EV_KEY, []);
    const objectives = await load(OBJ_KEY, MOCK_OBJS);
    set({ events, objectives, loading: false });
  },

  addEvent: async (event) => {
    set(s => {
      const events = [event, ...s.events];
      persist(EV_KEY, events);
      return { events };
    });
    syncToSB('timeline_events', {
      id: event.id, timeline_time: event.timeline_time, record_time: event.record_time,
      raw_content: event.raw_content, type: event.type, status: event.status,
      objective_id: event.objective_id || null, ai_metadata: event.ai_metadata || {}
    });
    if (event.objective_id && (event.ai_metadata?.progress_delta || 0) > 0) {
      get().addProgress(event.objective_id, event.ai_metadata.progress_delta || 0);
    }
  },

  confirmEvent: async (id) => {
    set(s => {
      const events = s.events.map(e => e.id === id ? { ...e, status: 'done' as const } : e);
      persist(EV_KEY, events);
      const ev = events.find(e => e.id === id);
      if (ev) syncToSB('timeline_events', ev);
      return { events };
    });
  },

  updateEvent: async (id, u) => {
    set(s => {
      const events = s.events.map(e => e.id === id ? { ...e, ...u } : e);
      persist(EV_KEY, events);
      const ev = events.find(e => e.id === id);
      if (ev) syncToSB('timeline_events', ev);
      return { events };
    });
  },

  deleteEvent: async (id) => {
    set(s => {
      const events = s.events.filter(e => e.id !== id);
      persist(EV_KEY, events);
      return { events };
    });
    deleteFromSB('timeline_events', id);
  },

  addObjective: async (o) => {
    set(s => {
      const objectives = [...s.objectives, o];
      persist(OBJ_KEY, objectives);
      return { objectives };
    });
    syncToSB('objectives', { id: o.id, title: o.title, target: o.target, current: o.current, color: o.color });
  },

  updateObjective: async (id, u) => {
    set(s => {
      const objectives = s.objectives.map(o => o.id === id ? { ...o, ...u } : o);
      persist(OBJ_KEY, objectives);
      const obj = objectives.find(o => o.id === id);
      if (obj) syncToSB('objectives', obj);
      return { objectives };
    });
  },

  deleteObjective: async (id) => {
    set(s => {
      const objectives = s.objectives.filter(o => o.id !== id);
      const events = s.events.map(e => e.objective_id === id ? { ...e, objective_id: undefined } : e);
      persist(OBJ_KEY, objectives);
      persist(EV_KEY, events);
      return { objectives, events };
    });
    deleteFromSB('objectives', id);
  },

  addProgress: async (objId, delta) => {
    set(s => {
      const objectives = s.objectives.map(o =>
        o.id === objId ? { ...o, current: o.current + delta } : o
      );
      persist(OBJ_KEY, objectives);
      const obj = objectives.find(o => o.id === objId);
      if (obj) syncToSB('objectives', obj);
      return { objectives };
    });
  },
}));
