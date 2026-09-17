const stripEmoji = (s) => (typeof s === 'string' ? s.replace(/\p{Emoji}/gu, '') : s);
const origLog = console.log, origError = console.error, origWarn = console.warn;
console.log = (...args) => origLog(...args.map(stripEmoji));
console.error = (...args) => origError(...args.map(stripEmoji));
console.warn = (...args) => origWarn(...args.map(stripEmoji));

import('../../src/scripts/test-socket-lbs.js').catch((e) => { console.error('FAIL', e && e.message ? e.message : e); process.exit(1); });
