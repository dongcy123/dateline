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

// ==========================================
// 离线同步队列 — 失败自动重试，指数退避
// ==========================================
const SYNC_QUEUE_KEY = '__kw_sync_queue__';
let _sq = [];
let _sqBusy = false;

// 从 localStorage 恢复上次未完成的队列
try {
  const saved = localStorage.getItem(SYNC_QUEUE_KEY);
  if (saved) { _sq = JSON.parse(saved); console.log('[Sync] loaded ' + _sq.length + ' pending items'); }
} catch {}

const _sqPersist = () => {
  try { localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(_sq)); } catch {}
};

const _sqProcess = async () => {
  if (_sqBusy || _sq.length === 0) return;
  _sqBusy = true;
  while (_sq.length > 0) {
    const item = _sq[0];
    try {
      const r = await window.Kawa.sbRest(item.method, item.table, item.body, item.opts);
      if (r.ok) {
        _sq.shift(); _sqPersist();
        console.log('[Sync] ✓ ' + item.table + ' synced (' + _sq.length + ' remaining)');
        continue;
      }
    } catch {}
    item.retries = (item.retries || 0) + 1;
    if (item.retries > 5) {
      console.warn('[Sync] ✗ giving up on ' + item.table + ' after 5 retries');
      _sq.shift(); _sqPersist();
      continue;
    }
    const delay = Math.min(1000 * Math.pow(2, item.retries - 1), 30000);
    console.log('[Sync] retry #' + item.retries + ' for ' + item.table + ' in ' + (delay / 1000) + 's');
    await new Promise(r => setTimeout(r, delay));
  }
  _sqBusy = false;
};

// 带自动重试的保存 — 失败静默入队
window.Kawa.sbRestSafe = async (method, table, body, opts = {}) => {
  const r = await window.Kawa.sbRest(method, table, body, opts);
  if (!r.ok) {
    _sq.push({ method, table, body, opts, ts: Date.now(), retries: 0 });
    _sqPersist();
    _sqProcess();
  }
  return r;
};

window.Kawa.syncRemaining = () => _sq.length;

// 页面启动时自动重试上次未完成的同步
if (_sq.length > 0) {
  console.log('[Sync] resuming ' + _sq.length + ' pending items...');
  _sqProcess();
}

window.Kawa.saveEventToSB = async (ev) => {
  const body = {
    id: ev.id, timeline_time: ev.timeline_time, record_time: ev.record_time,
    raw_content: ev.raw_content, type: ev.type, status: ev.status,
    objective_id: ev.objective_id || null, is_key_node: ev.is_key_node || false,
    ai_metadata: ev.ai_metadata || {}, image_url: ev.image_url || null
  };
  const r = await window.Kawa.sbRestSafe('POST', 'timeline_events', body, { upsert: true });
  if (!r.ok) console.warn('[SB] save event failed (queued):', r.error);
  return r.ok;
};

window.Kawa.deleteEventFromSB = async (id) => {
  await window.Kawa.sbRest('DELETE', 'timeline_events?id=eq.' + encodeURIComponent(id));
};

window.Kawa.saveObjToSB = async (obj) => {
  const body = { id: obj.id, title: obj.title, target: obj.target, current: obj.current, color: obj.color };
  const r = await window.Kawa.sbRestSafe('POST', 'objectives', body, { upsert: true });
  if (!r.ok) console.warn('[SB] save obj failed (queued):', r.error);
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