let _storageOk: boolean | null = null; // null=未检测, true=可用, false=不可用

export const storageAvailable = (): boolean => {
  if (_storageOk !== null) return _storageOk;
  try {
    const testKey = '__kw_storage_test__';
    localStorage.setItem(testKey, '1');
    const result = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    _storageOk = result === '1';
  } catch {
    _storageOk = false;
  }
  if (!_storageOk) {
    console.warn('[Storage] localStorage 不可用 — 请检查 Safari 隐私设置，或使用 Chrome。数据仅通过 Supabase 持久化。');
  }
  return _storageOk;
};

export const load = <T>(key: string): T | null => {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const save = <T>(key: string, value: T): boolean => {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
