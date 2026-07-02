import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_KEY } from './constants';

const sb = createClient(SB_URL, SB_KEY);
console.log('[Supabase] SDK connected');

// REST API types
interface RestOpts {
  upsert?: boolean;
}

interface RestResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error?: string;
}

// REST API 直达 (不依赖 SDK, 更可靠)
export const sbRest = async <T = unknown>(
  method: string,
  table: string,
  body?: Record<string, unknown>,
  opts: RestOpts = {}
): Promise<RestResult<T>> => {
  const preferParts: string[] = [];
  if (opts.upsert) preferParts.push('resolution=merge-duplicates');
  preferParts.push(method === 'GET' ? 'return=representation' : 'return=minimal');

  const headers: Record<string, string> = {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    Prefer: preferParts.join(', '),
  };

  const url = `${SB_URL}/rest/v1/${table}`;
  const fetchOpts: RequestInit = { method, headers };
  if (body) fetchOpts.body = JSON.stringify(body);

  try {
    const r = await fetch(url, fetchOpts);
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    return { ok: true, data: method === 'GET' ? (await r.json()) as T : null };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), data: null };
  }
};

// Load from Supabase
export const loadFromSB = async () => {
  // Try REST first (more reliable)
  const [evR, objR] = await Promise.all([
    sbRest<unknown[]>('GET', 'timeline_events?order=timeline_time.desc'),
    sbRest<unknown[]>('GET', 'objectives?order=created_at.asc'),
  ]);

  if (evR.ok || objR.ok) {
    console.log(`[SB:REST] loaded ${(evR.data || []).length} events, ${(objR.data || []).length} objectives`);
    return { events: evR.data || [], objectives: objR.data || [] };
  }

  // Fallback to SDK
  try {
    const [evRes, objRes] = await Promise.all([
      sb.from('timeline_events').select('*').order('timeline_time', { ascending: false }),
      sb.from('objectives').select('*').order('created_at', { ascending: true }),
    ]);
    if (evRes.error) console.warn('[SB:SDK] events:', evRes.error.message);
    if (objRes.error) console.warn('[SB:SDK] objectives:', objRes.error.message);
    console.log(`[SB:SDK] loaded ${(evRes.data || []).length} events, ${(objRes.data || []).length} objectives`);
    return { events: evRes.data || [], objectives: objRes.data || [] };
  } catch (e: unknown) {
    console.warn('[SB:SDK] load error:', e instanceof Error ? e.message : String(e));
    return null;
  }
};

// Save event to Supabase
export const saveEventToSB = async (ev: Record<string, unknown>): Promise<boolean> => {
  const body = {
    id: ev.id,
    timeline_time: ev.timeline_time,
    record_time: ev.record_time,
    raw_content: ev.raw_content,
    type: ev.type,
    status: ev.status,
    objective_id: (ev as { objective_id?: string }).objective_id || null,
    is_key_node: (ev as { is_key_node?: boolean }).is_key_node || false,
    ai_metadata: (ev as { ai_metadata?: Record<string, unknown> }).ai_metadata || {},
  };

  const r = await sbRest('POST', 'timeline_events', body as unknown as Record<string, unknown>, { upsert: true });
  if (r.ok) {
    console.log('[SB:REST] event saved');
    return true;
  }
  console.warn('[SB:REST] save event failed:', r.error);

  // Fallback to SDK
  try {
    const { error } = await sb.from('timeline_events').upsert(body);
    if (error) {
      console.warn('[SB:SDK] save event:', error.message);
      return false;
    }
    console.log('[SB:SDK] event saved');
    return true;
  } catch (e: unknown) {
    console.warn('[SB:SDK] save event error:', e instanceof Error ? e.message : String(e));
    return false;
  }
};

// Delete event from Supabase
export const deleteEventFromSB = async (id: string): Promise<void> => {
  const r = await sbRest('DELETE', `timeline_events?id=eq.${encodeURIComponent(id)}`);
  if (r.ok) {
    console.log('[SB:REST] event deleted');
    return;
  }
  try {
    const { error } = await sb.from('timeline_events').delete().eq('id', id);
    if (error) console.warn('[SB:SDK] delete event:', error.message);
  } catch (e: unknown) {
    console.warn('[SB:SDK] delete event error:', e instanceof Error ? e.message : String(e));
  }
};

// Save objective to Supabase
export const saveObjToSB = async (obj: Record<string, unknown>): Promise<boolean> => {
  const body = {
    id: obj.id,
    title: obj.title,
    target: obj.target,
    current: obj.current,
    color: obj.color,
  };

  const r = await sbRest('POST', 'objectives', body as unknown as Record<string, unknown>, { upsert: true });
  if (r.ok) {
    console.log('[SB:REST] obj saved');
    return true;
  }
  console.warn('[SB:REST] save obj failed:', r.error);

  try {
    const { error } = await sb.from('objectives').upsert(body);
    if (error) {
      console.warn('[SB:SDK] save obj:', error.message);
      return false;
    }
    return true;
  } catch (e: unknown) {
    console.warn('[SB:SDK] save obj error:', e instanceof Error ? e.message : String(e));
    return false;
  }
};

// Delete objective from Supabase
export const deleteObjFromSB = async (id: string): Promise<void> => {
  const r = await sbRest('DELETE', `objectives?id=eq.${encodeURIComponent(id)}`);
  if (r.ok) {
    console.log('[SB:REST] obj deleted');
    return;
  }
  try {
    const { error } = await sb.from('objectives').delete().eq('id', id);
    if (error) console.warn('[SB:SDK] delete obj:', error.message);
  } catch (e: unknown) {
    console.warn('[SB:SDK] delete obj error:', e instanceof Error ? e.message : String(e));
  }
};
