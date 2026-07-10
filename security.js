'use strict';

function safeLocalRedirect(value, fallback = '/') {
  const target = String(value || '').trim();
  if (!target.startsWith('/') || target.startsWith('//')) return fallback;

  try {
    const parsed = new URL(target, 'http://local.invalid');
    if (parsed.origin !== 'http://local.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

module.exports = { safeLocalRedirect };
