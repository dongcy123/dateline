// ==========================================
// 存储: Supabase + localStorage 双写
// ==========================================
window.Kawa = window.Kawa || {};

const { uid, OBJ_PALETTE, TYPE_LABELS, EV_KEY, OBJ_KEY, MOCK_OBJS, MOCK_EVENTS } = window.Kawa;

let _storageOk = null;

window.Kawa.storageAvailable = () => {
  if (_storageOk !== null) return _storageOk;
  try {
    const testKey = '__kw_storage_test__';
    localStorage.setItem(testKey, '1');
    const result = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    _storageOk = result === '1';
  } catch { _storageOk = false; }
  if (!_storageOk) console.warn('[Storage] localStorage 不可用');
  return _storageOk;
};

window.Kawa.load = (k) => {
  if (!window.Kawa.storageAvailable()) return null;
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; }
};

window.Kawa.save = (k, v) => {
  if (!window.Kawa.storageAvailable()) return false;
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
};

// Supabase
const SB_URL = 'https://gduqrtzoggpjyifxvzxy.supabase.co';
const SB_KEY = 'sb_publishable_8q1OXyDCIo6wcn82ReOa4w_-3azo0lH';
let sb = null;

try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    sb = supabase.createClient(SB_URL, SB_KEY);
    console.log('[Supabase] SDK connected');
  } else {
    console.warn('[Supabase] SDK not loaded');
  }
} catch (e) {
  console.warn('[Supabase] init error:', e.message);
}

window.Kawa.sbRest = async (method, table, body, opts = {}) => {
  const preferParts = [];
  if (opts.upsert) preferParts.push('resolution=merge-duplicates');
  preferParts.push(method === 'GET' ? 'return=representation' : 'return=minimal');
  const headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': preferParts.join(', ')
  };
  const url = '/api/sb/rest/v1/' + table;
  const fetchOpts = { method, headers };
  if (body) fetchOpts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, fetchOpts);
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + r.statusText);
    return { ok: true, data: method === 'GET' ? await r.json() : null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

window.Kawa.loadFromSB = async () => {
  const [evR, objR] = await Promise.all([
    window.Kawa.sbRest('GET', 'timeline_events?order=timeline_time.desc'),
    window.Kawa.sbRest('GET', 'objectives?order=created_at.asc')
  ]);
  if (evR.ok || objR.ok) {
    console.log('[SB:REST] loaded ' + (evR.data || []).length + ' events, ' + (objR.data || []).length + ' objectives');
    return { events: evR.data || [], objectives: objR.data || [] };
  }
  if (!sb) return null;
  try {
    const [evRes, objRes] = await Promise.all([
      sb.from('timeline_events').select('*').order('timeline_time', { ascending: false }),
      sb.from('objectives').select('*').order('created_at', { ascending: true })
    ]);
    if (evRes.error) console.warn('[SB:SDK] events:', evRes.error.message);
    if (objRes.error) console.warn('[SB:SDK] objectives:', objRes.error.message);
    return { events: evRes.data || [], objectives: objRes.data || [] };
  } catch (e) {
    console.warn('[SB:SDK] load error:', e.message);
    return null;
  }
};

window.Kawa.saveEventToSB = async (ev) => {
  const body = {
    id: ev.id, timeline_time: ev.timeline_time, record_time: ev.record_time,
    raw_content: ev.raw_content, type: ev.type, status: ev.status,
    objective_id: ev.objective_id || null, is_key_node: ev.is_key_node || false,
    ai_metadata: ev.ai_metadata || {}, image_url: ev.image_url || null
  };
  const r = await window.Kawa.sbRest('POST', 'timeline_events', body, { upsert: true });
  if (!r.ok) console.warn('[SB] save event failed:', r.error);
  return r.ok;
};

window.Kawa.deleteEventFromSB = async (id) => {
  await window.Kawa.sbRest('DELETE', 'timeline_events?id=eq.' + encodeURIComponent(id));
};

window.Kawa.saveObjToSB = async (obj) => {
  const body = { id: obj.id, title: obj.title, target: obj.target, current: obj.current, color: obj.color };
  const r = await window.Kawa.sbRest('POST', 'objectives', body, { upsert: true });
  if (!r.ok) console.warn('[SB] save obj failed:', r.error);
  return r.ok;
};

window.Kawa.deleteObjFromSB = async (id) => {
  await window.Kawa.sbRest('DELETE', 'objectives?id=eq.' + encodeURIComponent(id));
};

// 图片上传到 Supabase Storage
window.Kawa.uploadImage = async (file) => {
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = window.Kawa.uid() + '.' + ext;
  const bucket = 'event-images';

  // 客户端压缩
  const compressed = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1200;
      let w = img.width, h = img.height;
      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(resolve, 'image/jpeg', 0.75);
    };
    img.src = URL.createObjectURL(file);
  });

  const res = await fetch(
    '/api/sb/storage/v1/object/' + bucket + '/' + filename,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: compressed
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed: ' + res.status);
  }

  const data = await res.json();
  const publicUrl = '/api/sb/storage/v1/object/public/' + bucket + '/' + filename;
  console.log('[Storage] Image uploaded:', publicUrl);
  return publicUrl;
};
