export const uid = (): string =>
  window.crypto?.randomUUID?.() ||
  Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

const safeDate = (d: unknown): Date | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d as string);
  if (isNaN(date.getTime())) return null;
  return date;
};

export const fmtTime = (d: Date | string): string => {
  const date = safeDate(d);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
};

export const fmtDate = (d: Date | string): string => {
  const date = safeDate(d);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
};

export const tsDay = (d: Date | string): string => {
  const date = safeDate(d);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const todayStr = (): string => tsDay(new Date());
