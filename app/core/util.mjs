/** Provider-, storage-, and DOM-independent primitives. */
export const clone = value => structuredClone(value);
export const id = (prefix = 'id') => `${prefix}-${crypto.randomUUID()}`;
export const now = () => new Date().toISOString();
export const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const validKey = value => typeof value === 'string' && value.length > 0 && value.length <= 240 && !['__proto__', 'constructor', 'prototype'].includes(value);
export function requireThat(condition, message, code = 'INVALID') {
  if (!condition) throw Object.assign(new Error(message), {code});
}
export function safeJSON(text) {
  return JSON.parse(text, (key, value) => {
    requireThat(!['__proto__', 'constructor', 'prototype'].includes(key), `Unsafe data field: ${key}`);
    return value;
  });
}
export function canonical(value) {
  const active = new WeakSet();
  function visit(v) {
    if (v === null || typeof v !== 'object') {
      requireThat(typeof v !== 'number' || Number.isFinite(v), 'Non-finite numbers cannot be saved.');
      return JSON.stringify(v);
    }
    requireThat(!active.has(v), 'Circular data cannot be saved.');
    active.add(v);
    const output = Array.isArray(v)
      ? '[' + v.map(item => visit(item) ?? 'null').join(',') + ']'
      : '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + visit(v[k])).join(',') + '}';
    active.delete(v);
    return output;
  }
  return visit(value);
}
export async function hash(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Stopped', 'AbortError'));
    const abort = () => {clearTimeout(timer); reject(new DOMException('Stopped', 'AbortError'));};
    const timer = setTimeout(() => {signal?.removeEventListener('abort', abort); resolve();}, ms);
    signal?.addEventListener('abort', abort, {once: true});
  });
}
export const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export const slug = value => String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
export function download(filename, value, type = 'application/json') {
  const url = URL.createObjectURL(value instanceof Blob ? value : new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], {type}));
  const a = Object.assign(document.createElement('a'), {href: url, download: filename});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function safeImage(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  if (/^\/?(?:public\/)?art\/[a-zA-Z0-9_-]+\.(svg|webp|png|jpg)$/.test(value)) return value;
  if (/^blob:/.test(value)) return value;
  return '';
}
