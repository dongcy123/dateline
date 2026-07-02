import { sbRest } from './supabase';

interface SyncItem {
  method: string;
  table: string;
  body?: Record<string, unknown>;
  opts?: { upsert?: boolean };
  ts: number;
  retries: number;
}

const SYNC_QUEUE_KEY = '__kw_sync_queue__';
let _syncQueue: SyncItem[] = [];
let _syncBusy = false;

// Load persisted queue
try {
  const saved = localStorage.getItem(SYNC_QUEUE_KEY);
  if (saved) {
    _syncQueue = JSON.parse(saved) as SyncItem[];
    console.log('[Sync] loaded ' + _syncQueue.length + ' pending items');
  }
} catch { /* ignore */ }

const _persistQueue = (): void => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(_syncQueue));
  } catch { /* ignore */ }
};

export const processQueue = async (): Promise<void> => {
  if (_syncBusy || _syncQueue.length === 0) return;
  _syncBusy = true;
  while (_syncQueue.length > 0) {
    const item = _syncQueue[0];
    try {
      const r = await sbRest(item.method, item.table, item.body, item.opts);
      if (r.ok) {
        _syncQueue.shift();
        _persistQueue();
        console.log('[Sync] ✓ ' + item.table + ' synced (' + _syncQueue.length + ' remaining)');
        continue;
      }
    } catch { /* ignore */ }
    item.retries = (item.retries || 0) + 1;
    if (item.retries > 5) {
      console.warn('[Sync] ✗ giving up on ' + item.table + ' after 5 retries');
      _syncQueue.shift();
      _persistQueue();
      continue;
    }
    const delay = Math.min(1000 * Math.pow(2, item.retries - 1), 30000);
    await new Promise(r => setTimeout(r, delay));
  }
  _syncBusy = false;
};

export const sbRestSafe = async (
  method: string,
  table: string,
  body?: Record<string, unknown>,
  opts: { upsert?: boolean } = {}
): Promise<ReturnType<typeof sbRest>> => {
  const r = await sbRest(method, table, body, opts);
  if (!r.ok) {
    _syncQueue.push({ method, table, body, opts, ts: Date.now(), retries: 0 });
    _persistQueue();
    processQueue();
  }
  return r;
};

export const hasPendingSync = (): boolean => _syncQueue.length > 0;

// Check on load
if (_syncQueue.length > 0) processQueue();
