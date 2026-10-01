/* Sip & Sail app: everything runs locally, no network needed. */
(function () {
  'use strict';
  const C = window.SSCore;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const txt = id => document.getElementById(id).textContent;

  const DATA = C.parseData(txt('ing-data'), txt('recipe-data'), txt('list-data'));
  const { ING, recipes, must, coco } = DATA;
  const byId = new Map(recipes.map(r => [r.id, r]));
  const byName = n => DATA.byName.get(C.norm(n));
  const HERO = byName('Coconut Patrón Margarita');
  const TOTAL = recipes.length;

  // ---------- storage (always wrapped: private mode or blocked storage must not break the app) ----------
  const mem = {};
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('sipsail.' + k); if (v != null) return JSON.parse(v); } catch (e) { /* ignore */ }
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d;
    },
    set(k, v) { mem[k] = v; try { localStorage.setItem('sipsail.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const DEFAULT_PRICES = { cocktail: 16, frozen: 16, martini: 17, wine: 14, beer: 10, shot: 12, spiked: 14, coffee: 5, mocktail: 8, soda: 4, water: 4.5 };
  const PRICE_LABELS = { cocktail: 'Cocktail', frozen: 'Frozen drink', martini: 'Martini', wine: 'Wine or spritz', beer: 'Beer', shot: 'Shot or sipper', spiked: 'Spiked coffee', coffee: 'Specialty coffee', mocktail: 'Mocktail', soda: 'Soda', water: 'Bottled water' };
  const S = Object.assign({ units: 'both', theme: 'auto', people: ['Me', 'Partner'], person: 0, pkg: '' }, store.get('settings', {}));
  S.prices = Object.assign({}, DEFAULT_PRICES, S.prices || {});
  let favs = new Set(store.get('favs', []));
  let tried = store.get('tried', {});
  let log = store.get('log', []);
  let shop = new Set(store.get('shop', []));
  const saveS = () => store.set('settings', S);
  const saveFavs = () => store.set('favs', [...favs]);
  const saveTried = () => store.set('tried', tried);
  const saveLog = () => store.set('log', log);
  const saveShop = () => store.set('shop', [...shop]);
  if (!store.get('seeded', false) && HERO) {
    favs.add(HERO.id);
    tried[HERO.id] = { rating: 5, note: 'Phenomenal. Our favorite so far!', bar: '', ts: Date.now() };
    saveFavs(); saveTried(); store.set('seeded', true);
  }

  const hostTheme = document.documentElement.getAttribute('data-theme');
  function applyTheme() {
    const r = document.documentElement;
    if (S.theme === 'auto') { if (hostTheme) r.setAttribute('data-theme', hostTheme); else r.removeAttribute('data-theme'); }
    else r.setAttribute('data-theme', S.theme);
  }

  // ---------- small utils ----------
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const money = n => '$' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0);
  const people = () => (S.people && S.people.length ? S.people : ['Me']).map((p, i) => p || `Person ${i + 1}`);

  // ---------- icons ----------
  const I = {
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
    heartF: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    dice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 10h10M7 14h6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    glassPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l-1.6 15H6.6z"/><path d="M19 9v6M16 12h6"/></svg>',
    chev: '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>',
    no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.2"/></svg>',
    wave: '<svg viewBox="0 0 160 60" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M2 20c13 0 13-10 26-10s13 10 26 10 13-10 26-10 13 10 26 10 13-10 26-10 13 10 26 10"/><path d="M2 40c13 0 13-10 26-10s13 10 26 10 13-10 26-10 13 10 26 10 13-10 26-10 13 10 26 10"/></svg>'
  };

  // ---------- generated glass icons ----------
  const GL = {
    martini: { body: 'M7 9H41L24 27Z', extra: 'M24 27V40M17 41H31', top: 12, rim: [37, 9] },
    coupe: { body: 'M8 11H40C40 21 33 26 24 26C15 26 8 21 8 11Z', extra: 'M24 26V40M17 41H31', top: 14, rim: [38, 11] },
    rocks: { body: 'M10 17L12 40H36L38 17Z', top: 21, ice: [[14, 24, 9], [24, 27, 8]], rim: [36, 17] },
    highball: { body: 'M14 7L15 41H33L34 7Z', top: 11, ice: [[17, 14, 8], [23, 23, 8], [17, 31, 7]], rim: [33, 7], straw: [[30, 2, 25, 30]] },
    collins: { body: 'M15.5 5L16 42H32L32.5 5Z', top: 9, ice: [[18, 12, 8], [23, 22, 7], [18, 31, 7]], rim: [32, 5], straw: [[30, 0, 25, 30]] },
    hurricane: { body: 'M16 5C15 11 20 14 19 20C18 26 13 28 14 32C15 36 19 37 24 37C29 37 33 36 34 32C35 28 30 26 29 20C28 14 33 11 32 5Z', extra: 'M24 37V41M18 42H30', top: 9, rim: [31, 5], straw: [[28, 0, 24, 26]] },
    flute: { body: 'M19 4C18 13 18 21 20 26C21 28 27 28 28 26C30 21 30 13 29 4Z', extra: 'M24 28V41M18 42H30', top: 8, rim: [29, 4] },
    wine: { body: 'M14 6C13 16 15 24 24 25C33 24 35 16 34 6Z', extra: 'M24 25V41M17 42H31', top: 12, ice: [[18, 14, 7], [25, 16, 6]], rim: [33, 6] },
    goblet: { body: 'M9 7C8 19 13 27 24 27C35 27 40 19 39 7Z', extra: 'M24 27V41M16 42H32', top: 11, ice: [[14, 13, 8], [24, 15, 8]], rim: [37, 7] },
    marg: { body: 'M6 8H42C40 14 33 15 28 16C27 18 27 21 25 23H23C21 21 21 18 20 16C15 15 8 14 6 8Z', extra: 'M24 23V41M17 42H31', top: 10, rim: [40, 8] },
    shot: { body: 'M16 21L18 41H30L32 21Z', top: 24 },
    pint: { body: 'M13 6L15.5 42H32.5L35 6Z', top: 9, rim: [34, 6] },
    snifter: { body: 'M14 13C9 22 13 33 24 33C35 33 39 22 34 13Z', extra: 'M24 33V40M17 41H31', top: 24 },
    mug: { body: 'M11 11V40Q11 41.5 12.5 41.5H31.5Q33 41.5 33 40V11Z', extra: 'M33 17C40 17 40 33 33 33', top: 15 },
    bowl: { body: 'M5 17H43C43 31 35 37 24 37C13 37 5 31 5 17Z', extra: 'M17 39H31', top: 20, rim: [41, 17], straw: [[30, 5, 26, 30], [34, 6, 28, 30]] },
    tiki: { opaque: true }, copper: { opaque: true }, cup: { opaque: true }, coconut: { opaque: true }
  };
  GL.dbl = GL.rocks; GL.nick = GL.coupe; GL.julep = GL.highball;
  const ICE_METHODS = new Set(['bu', 'shr', 'str', 'sw', 'shd', 'mu', 'mus']);
  const UMBRELLAS = ['#e9573f', '#1f9ea6', '#f2c230', '#8e5bd6', '#ef6fa3'];

  function buildDefs() {
    const d = $('#glass-defs');
    let s = '<linearGradient id="gl-hi" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gl-sh" x1="0" x2="0" y1="0" y2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>';
    for (const [k, g] of Object.entries(GL)) if (g.body && !s.includes(`id="cp-${k}"`)) s += `<clipPath id="cp-${k}"><path d="${g.body}"/></clipPath>`;
    d.innerHTML = s;
  }
  function clipId(type) { for (const [k, g] of Object.entries(GL)) if (g === GL[type]) return k; return 'rocks'; }

  function garnishSVG(r, x, y) {
    const g = (r.garnish || '').toLowerCase();
    const wheel = c => `<g transform="translate(${x} ${y})"><circle r="4.6" fill="${c}" stroke="#fff" stroke-width=".9"/><path d="M0-4.2V4.2M-4.2 0H4.2M-3-3 3 3M3-3-3 3" stroke="#fff" stroke-width=".55" opacity=".85"/></g>`;
    if (/olive/.test(g) && r.glass === 'martini') return `<path d="M31 3 21 17" stroke="currentColor" stroke-width="1" opacity=".7"/><circle cx="24.5" cy="12" r="2.7" fill="#7d9a2c"/>`;
    if (/onion/.test(g)) return `<path d="M31 3 21 17" stroke="currentColor" stroke-width="1" opacity=".7"/><circle cx="24.5" cy="12" r="2.5" fill="#f3efe2" stroke="#c9c2a8" stroke-width=".6"/>`;
    if (/pineapple/.test(g)) return `<g transform="translate(${x} ${y})"><path d="M-5 1 5 1 0-5Z" fill="#f5cf45" stroke="#d9a520" stroke-width=".6"/><path d="M0-5-2.2-9.5M0-5 0-10.5M0-5 2.2-9.5" stroke="#3f9c4a" stroke-width="1.3" stroke-linecap="round"/></g>`;
    if (/lime/.test(g)) return wheel('#93c544');
    if (/lemon/.test(g)) return wheel('#f2d23a');
    if (/blood orange/.test(g)) return wheel('#c9382c');
    if (/orange/.test(g)) return wheel('#f6911b');
    if (/grapefruit/.test(g)) return wheel('#f09a86');
    if (/strawberr/.test(g)) return `<g transform="translate(${x} ${y})"><path d="M0 4C-4 1-4.5-2.5-2.5-3.5-1-4.2 0-3 0-3 0-3 1-4.2 2.5-3.5 4.5-2.5 4 1 0 4Z" fill="#e2243a"/><path d="M-2-3.6 0-5.5 2-3.6" stroke="#3f9c4a" stroke-width="1.2" fill="none"/></g>`;
    if (/cherr/.test(g)) return `<g transform="translate(${x} ${y})"><path d="M0-2Q1-7 4.5-8" stroke="#3b6b2a" stroke-width=".9" fill="none"/><circle r="2.7" fill="#c4142b"/></g>`;
    if (/mint|basil/.test(g)) return `<g transform="translate(${x} ${y})"><ellipse rx="2.2" ry="4.2" transform="rotate(-28)" fill="#3f9c4a"/><ellipse rx="2.1" ry="3.8" transform="translate(3 -.5) rotate(32)" fill="#56b35e"/></g>`;
    if (/raspberr|blackberr|blueberr|berries/.test(g)) return `<g transform="translate(${x} ${y})"><circle r="2.8" fill="${/blue/.test(g) ? '#3a3a8c' : /black/.test(g) ? '#3b0a28' : '#c0175a'}"/><circle cx="3.5" cy="1" r="2.4" fill="${/blue/.test(g) ? '#4a4aa0' : /black/.test(g) ? '#4b1236' : '#d0306c'}"/></g>`;
    if (/cucumber/.test(g)) return wheel('#9ccc65');
    if (/coffee bean/.test(g)) return `<g transform="translate(${x - 4} ${y + 2})"><ellipse rx="1.6" ry="2.3" fill="#3b2416"/><ellipse cx="3.6" rx="1.6" ry="2.3" fill="#3b2416"/></g>`;
    return '';
  }

  function glassSVG(r, size, extraCls) {
    const type = GL[r.glass] ? r.glass : 'rocks';
    const g = GL[type];
    const col = r.color;
    const tropical = r.cat === 'tiki' || (r.tags.has('tropical') && ['hurricane', 'tiki', 'coconut', 'bowl'].includes(type));
    const umb = UMBRELLAS[hash(r.id) % UMBRELLAS.length];
    const umbrella = (x, y) => `<g transform="translate(${x} ${y}) rotate(18)"><path d="M0 0 2.6 13" stroke="#7a5a3a" stroke-width="1"/><path d="M-7.5 1Q0-7 7.5 1Z" fill="${umb}"/><path d="M-7.5 1 0-4.6 7.5 1M-2.5 .2 0-4.6 2.5.2" stroke="#fff" stroke-opacity=".6" stroke-width=".6" fill="none"/></g>`;
    const steam = '<path d="M19 9c-2-2 2-4 0-6M25 9c-2-2 2-4 0-6M31 9c-2-2 2-4 0-6" stroke="currentColor" opacity=".45" fill="none" stroke-width="1.3" stroke-linecap="round"/>';
    let s = `<svg class="gl ${extraCls || ''}" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false">`;
    const whipped = r.items.some(i => i.key === 'whipped' && !i.opt);
    if (g.opaque) {
      if (type === 'tiki') {
        s += `<ellipse cx="24" cy="7.5" rx="10.6" ry="2.2" fill="${col}"/><path d="M13 7.5H35L34 41H14Z" fill="#8a5a33" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>` +
          '<path d="M17 15.5h5M26 15.5h5M24 18v6M18 29h12M18 32.5h12M21 29v3.5M24 29v3.5M27 29v3.5" stroke="#4a2c14" stroke-width="1.8" stroke-linecap="round"/>' + umbrella(30, 6);
      } else if (type === 'copper') {
        s += `<path d="M34 16C41 16 41 32 34 32" fill="none" stroke="#9a4f26" stroke-width="3"/><path d="M12 10L13 41H33L34 10Z" fill="#c26b3a"/><path d="M15 12.5 15.8 38.5" stroke="#eab08a" stroke-width="2" stroke-linecap="round" opacity=".75"/><path d="M12.3 16H33.7M12.9 35.5H33.1" stroke="#9a4f26" stroke-width="1.2"/><ellipse cx="23" cy="10" rx="11" ry="2" fill="${col}"/>` + garnishSVG(r, 33, 10);
      } else if (type === 'cup') {
        s += `<path d="M6 41.5C10 44 38 44 42 41.5" class="gl-o"/><path d="M37.5 21C44 21 44 31 35.5 31" class="gl-o"/><path d="M10 17L12.5 33C13.5 37 16.5 38.5 20 38.5H28C31.5 38.5 34.5 37 35.5 33L38 17Z" class="gl-cup" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="24" cy="17.4" rx="13.4" ry="2.5" fill="${col}"/>`;
        s += whipped ? '<g fill="#fffaf0" stroke="currentColor" stroke-opacity=".25" stroke-width=".6"><circle cx="19" cy="15" r="3.4"/><circle cx="24" cy="13.5" r="4"/><circle cx="29" cy="15" r="3.4"/></g>' : (r.cat === 'coffee' && !/iced|freddo|frapp/i.test(r.name) ? steam : '');
      } else {
        s += `<path d="M12 22 34 6" stroke="#e9573f" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="27" r="15" fill="#6b4226"/><path d="M13 23c4 3 8 4 11 4M14 31c4 2 9 3 14 2M30 21c2 2 5 3 7 3" stroke="#4a2c18" stroke-width="1" fill="none"/><ellipse cx="24" cy="15.5" rx="11" ry="3.2" fill="#f3ecdc"/><ellipse cx="24" cy="15.8" rx="8.6" ry="2.2" fill="${col}"/>` + umbrella(31, 12);
      }
      return s + '</svg>';
    }
    const cp = clipId(type);
    const ice = ICE_METHODS.has(r.method) && g.ice;
    let inner = `<rect x="0" y="${g.top}" width="48" height="48" fill="${col}"/>`;
    if (r.frozen) inner += `<g fill="#fff" opacity=".35"><circle cx="18" cy="${g.top + 6}" r="1"/><circle cx="27" cy="${g.top + 9}" r="1.1"/><circle cx="22" cy="${g.top + 14}" r=".9"/><circle cx="30" cy="${g.top + 4}" r=".8"/><circle cx="16" cy="${g.top + 12}" r=".8"/></g>`;
    if (ice) inner += g.ice.map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="1.7" fill="#fff" fill-opacity=".34" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`).join('');
    if (r.tags.has('bubbly') && !ice) inner += `<g fill="none" stroke="#fff" stroke-opacity=".75" stroke-width=".7"><circle cx="21" cy="${g.top + 8}" r="1"/><circle cx="26" cy="${g.top + 13}" r="1.2"/><circle cx="23" cy="${g.top + 18}" r=".9"/><circle cx="27" cy="${g.top + 4}" r=".8"/></g>`;
    if (type === 'pint' && r.cat === 'beer') inner += `<rect x="0" y="${g.top}" width="48" height="4" fill="#fdf8ec"/>`;
    if (r.items.some(i => i.key === 'eggwhite' && !i.opt)) inner += `<rect x="0" y="${g.top}" width="48" height="2.6" fill="#fbf7ee"/>`;
    if (whipped) inner += `<rect x="0" y="${g.top - 1}" width="48" height="4" fill="#fffaf0"/>`;
    inner += '<rect width="48" height="48" fill="url(#gl-sh)"/><rect width="48" height="48" fill="url(#gl-hi)"/>';
    if (g.straw && (r.cat === 'tiki' || r.frozen || ['highball', 'collins', 'bowl'].includes(type)) && r.cat !== 'beer') s += g.straw.map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} ${x2} ${y2}" stroke="#e9573f" stroke-width="1.8" stroke-linecap="round"/>`).join('');
    s += `<g clip-path="url(#cp-${cp})">${inner}</g><path d="${g.body}" class="gl-o"/>`;
    if (g.extra) s += `<path d="${g.extra}" class="gl-o"/>`;
    if (r.method === 'hot' || (type === 'mug' && r.cat === 'coffee' && !/iced|cold/i.test(r.name)) || /^Hot /.test(r.name)) s += steam;
    if (whipped && type === 'mug') s += `<g fill="#fffaf0" stroke="currentColor" stroke-opacity=".25" stroke-width=".6"><circle cx="16.5" cy="11" r="3.2"/><circle cx="22" cy="9.5" r="3.8"/><circle cx="27.5" cy="10.5" r="3.4"/></g>`;
    if (g.rim) s += garnishSVG(r, g.rim[0], g.rim[1]);
    if (tropical && ['hurricane', 'bowl'].includes(type)) s += umbrella(type === 'bowl' ? 12 : 17, type === 'bowl' ? 11 : 4);
    return s + '</svg>';
  }

  // ---------- shared bits ----------
  function dots(r) {
    if (r.zero) return '<span class="zero-badge">0%</span>';
    let s = `<span class="dots" title="${C.STRENGTH[r.strength]}" aria-label="Strength: ${C.STRENGTH[r.strength]}">`;
    for (let i = 1; i <= 4; i++) s += `<i class="${i <= r.strength ? 'f' : ''}"></i>`;
    return s + '</span>';
  }
  function summary(r, n) {
    return r.items.filter(i => !i.opt && !['rim', 'dash', 'rinse', 'pinch'].includes(i.a.t) && ING[i.key].group !== 'accent')
      .slice(0, n || 4).map(i => {
        const ing = ING[i.key];
        if (i.mod && i.mod[0] === '=') return i.mod.slice(1);
        if (i.mod && ing.group === 'wine' && !/^or |^as | /.test(i.mod)) return i.mod;
        return (i.a.t === 'count' ? ing.plural : ing.name).replace(/ \(.*\)$/, '');
      }).join(' · ');
  }
  function marks(r) {
    return (favs.has(r.id) ? `<span class="mk mk-fav" aria-label="Saved">♥</span>` : '') + (r.must ? `<span class="mk mk-must" aria-label="Must-try">★</span>` : '');
  }
  function rowHTML(r) {
    const t = tried[r.id];
    return `<button class="row" type="button" data-act="open" data-id="${r.id}">${glassSVG(r, 44)}<span class="row-main"><span class="row-name">${esc(r.name)}${marks(r)}</span><span class="row-sub">${esc(summary(r))}</span></span><span class="row-side">${dots(r)}${t && t.rating ? `<span class="mk-must">${'★'.repeat(t.rating)}</span>` : r.frozen ? '<span>Frozen</span>' : ''}</span></button>`;
  }
  function cardHTML(r, sub) {
    return `<button class="dcard" type="button" data-act="open" data-id="${r.id}">${glassSVG(r, 56)}<b>${esc(r.name)}</b><span>${esc(sub || (r.zero ? 'Zero-proof' : r.base + ' · ' + C.STRENGTH[r.strength]))}</span></button>`;
  }
  function priceKind(r) {
    if (r.zero) return r.cat === 'coffee' ? 'coffee' : 'mocktail';
    if (r.cat === 'martini') return 'martini';
    if (r.cat === 'beer') return 'beer';
    if (r.cat === 'shot') return 'shot';
    if (r.cat === 'coffee') return 'spiked';
    if (r.cat === 'wine' || r.cat === 'bubbly') return 'wine';
    if (r.frozen) return 'frozen';
    return 'cocktail';
  }
  const tagList = r => [...r.tags].filter(t => !['pop', 'strong'].includes(t) && C.FLAVOR_LABELS[t]).map(t => C.FLAVOR_LABELS[t]);

  // ---------- overlays & history ----------
  const layer = $('#layer');
  const stack = [];
  let ignorePop = 0;
  function openOverlay(html, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = opts.cls || 'overlay';
    el.innerHTML = html;
    let pushed = false;
    if (opts.replace && stack.length) {
      const prev = stack.pop();
      prev.el.remove();
      pushed = prev.pushed;
    } else {
      try { history.pushState({ sipsail: stack.length + 1 }, ''); pushed = true; } catch (e) { pushed = false; }
    }
    layer.appendChild(el);
    const entry = { el, pushed, onClose: opts.onClose };
    stack.push(entry);
    document.body.style.overflow = 'hidden';
    el.addEventListener('click', e => { if (e.target === el && !opts.noScrimClose) closeTop(); });
    if (!opts.noFocus) setTimeout(() => {
      const f = el.querySelector('[data-autofocus]') || el.querySelector('button, [href], input, select, textarea');
      if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }, 30);
    return el;
  }
  function removeTop() {
    const e = stack.pop();
    if (!e) return null;
    e.el.remove();
    if (e.onClose) e.onClose();
    if (!stack.length) document.body.style.overflow = '';
    return e;
  }
  function closeTop() {
    const e = removeTop();
    if (e && e.pushed) { ignorePop++; try { history.back(); } catch (err) { ignorePop--; } }
  }
  window.addEventListener('popstate', () => {
    if (ignorePop > 0) { ignorePop--; return; }
    if (stack.length) removeTop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) closeTop(); });

  let toastTimer;
  function toast(msg, undo) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" id="toast-undo">Undo</button>' : ''}`;
    t.hidden = false;
    if (undo) $('#toast-undo').onclick = () => { undo(); t.hidden = true; };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 5000 : 2600);
  }
  function copyText(text, okMsg) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? okMsg : 'Copy blocked here. Select the text and copy it manually.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  // ---------- navigation ----------
  const VIEWS = ['home', 'browse', 'quiz', 'mybar', 'guide'];
  let view = VIEWS.includes(store.get('view', 'home')) ? store.get('view', 'home') : 'home';
  function go(v, opt) {
    view = v; store.set('view', v);
    VIEWS.forEach(x => { $('#v-' + x).hidden = x !== v; });
    $$('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.go === v ? 'page' : 'false'));
    render(v, opt);
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }
  function render(v, opt) {
    if (v === 'home') renderHome();
    else if (v === 'browse') renderBrowse(opt);
    else if (v === 'quiz') renderQuiz();
    else if (v === 'mybar') renderMyBar(opt);
    else if (v === 'guide') renderGuide(opt);
  }
  function refresh() { render(view); }

  // ---------- HOME ----------
  let surpriseMode = 'any';
  let mustTab = 0;
  const SURPRISE_MODES = [['any', 'Anything'], ['frozen', 'Frozen'], ['tropical', 'Tropical'], ['coconut', 'Coconut'], ['new', 'Not tried yet'], ['zero', 'Zero-proof']];
  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Late-night sips' : h < 11 ? 'Good morning' : h < 16 ? 'Good afternoon' : h < 19 ? 'Sail-away hour' : 'Good evening';
  }
  function drinkOfDay() {
    const pool = recipes.filter(r => (r.must || r.tags.has('pop')) && !r.zero && !['coffee', 'shot', 'beer'].includes(r.cat));
    return pool[hash(dayKey(Date.now())) % pool.length];
  }
  function renderHome() {
    const dod = drinkOfDay();
    const today = log.filter(e => dayKey(e.ts) === dayKey(Date.now()));
    const alc = today.filter(e => e.std >= 0.15).length;
    const water = today.filter(e => e.kind === 'water').length;
    const value = today.reduce((a, e) => a + (e.price || 0), 0);
    const ms = must[mustTab] || must[0];
    $('#v-home').innerHTML = `
      <div class="hero">
        <span class="wave" aria-hidden="true">${I.wave}</span>
        <p class="eyebrow">${esc(greeting())} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        <h2>What are we sipping?</h2>
        <p>${TOTAL} recipes, no whiskey, all on this phone. Spin for a random pick or narrow it down first.</p>
        <div class="chips" role="group" aria-label="Surprise me from">
          ${SURPRISE_MODES.map(([k, l]) => `<button class="chip" type="button" data-act="smode" data-k="${k}" aria-pressed="${surpriseMode === k}">${l}</button>`).join('')}
        </div>
        <div class="hero-cta">
          <button class="btn primary" type="button" data-act="surprise">${I.dice}Surprise me</button>
          <button class="btn ghost" type="button" data-go="browse" style="color:var(--navy-ink);border-color:var(--navy-2)">Browse all ${TOTAL}</button>
        </div>
      </div>

      <div class="split">
        <button class="tile quiz-tile" type="button" data-go="quiz">
          <p class="eyebrow">5 quick questions</p>
          <p class="display">How are you feeling?</p>
          <p>Answer by mood, place and flavor and get a match.</p>
        </button>
        <button class="tile" type="button" data-act="open" data-id="${dod.id}">
          <p class="eyebrow">Drink of the day</p>
          <div class="tile-top">${glassSVG(dod, 56)}<div><h3>${esc(dod.name)}</h3><p class="muted" style="font-size:13px">${esc(summary(dod, 3))}</p></div></div>
        </button>
      </div>

      <section>
        <div class="section-head"><h2>Because you loved the Coconut Patrón Margarita</h2></div>
        <p class="muted" style="margin:6px 0 10px">More coconut, more tequila, and a few creamy cousins.</p>
        <div class="carousel">${coco.map(r => cardHTML(r)).join('')}</div>
      </section>

      <section>
        <div class="section-head"><h2>Must-try cruise drinks</h2><button class="linkish" type="button" data-act="browse-must">See all</button></div>
        <div class="must-tabs" role="group" aria-label="Moment" style="margin:10px 0">
          ${must.map((m, i) => `<button class="chip" type="button" data-act="musttab" data-i="${i}" aria-pressed="${i === mustTab}">${esc(m.title)}</button>`).join('')}
        </div>
        <div class="rows">${ms.items.map(r => mustRow(r)).join('')}</div>
      </section>

      <section>
        <div class="section-head"><h2>Today's tab</h2><button class="linkish" type="button" data-go="mybar">Open tracker</button></div>
        <div class="tally" style="margin-top:10px">
          <div><b>${alc}</b><span>drinks logged</span></div>
          <div><b>${water}</b><span>waters</span></div>
          <div><b>${money(value)}</b><span>est. menu value</span></div>
        </div>
      </section>

      <section class="split">
        <button class="tile" type="button" data-act="guide" data-sec="pkg"><p class="eyebrow">Premium package</p><h3>What's covered, what isn't</h3><p class="muted">Up to $19 a drink, one at a time, and more.</p></button>
        <button class="tile" type="button" data-act="guide" data-sec="ports"><p class="eyebrow">Port sips</p><h3>Local drinks to try ashore</h3><p class="muted">Mediterranean, South America and the Caribbean.</p></button>
      </section>
      <p class="foot">Unofficial guide, not affiliated with Celebrity Cruises. Menus, prices and package rules can change; check onboard. Please drink responsibly.</p>`;
  }
  function mustRow(r) {
    return `<button class="row" type="button" data-act="open" data-id="${r.id}" data-kind="must">${glassSVG(r, 44)}<span class="row-main"><span class="row-name">${esc(r.name)}${favs.has(r.id) ? '<span class="mk mk-fav">♥</span>' : ''}</span><span class="row-sub" style="white-space:normal">${esc(r.mustWhy)}</span></span><span class="row-side">${dots(r)}</span></button>`;
  }

  // ---------- BROWSE ----------
  const F = { q: '', cats: new Set(), inc: new Set(), exc: new Set(), flav: new Set(), str: new Set(), quick: new Set(), any: false, sort: 'az' };
  const QUICK = [['must', 'Must-try'], ['fav', 'Saved'], ['frozen', 'Frozen'], ['coconut', 'Coconut'], ['zero', 'Zero-proof'], ['untried', 'Not tried yet']];
  const FLAVORS = ['fruity', 'tropical', 'coconut', 'creamy', 'sweet', 'tart', 'citrus', 'fresh', 'minty', 'herbal', 'floral', 'berry', 'bubbly', 'bitter', 'dry', 'spicy', 'ginger', 'smoky', 'coffee', 'choc', 'nutty', 'dessert', 'savory', 'brunch', 'elegant', 'fun', 'hot'];
  const famCount = {};
  recipes.forEach(r => r.fams.forEach(f => { famCount[f] = (famCount[f] || 0) + 1; }));
  const famGroup = {};
  Object.values(ING).forEach(i => { if (!famGroup[i.fam]) famGroup[i.fam] = i.group; });
  const HIDE_FAMS = new Set(['Water', 'Sugar', 'Simple syrup', 'Salt']);
  const tagCount = {};
  recipes.forEach(r => r.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));

  function filterCount() { return F.cats.size + F.inc.size + F.exc.size + F.flav.size + F.str.size + F.quick.size; }
  function matches(r, tokens) {
    if (F.cats.size && !F.cats.has(r.cat)) return false;
    if (F.str.size && !F.str.has(r.strength)) return false;
    for (const f of F.exc) if (r.fams.has(f)) return false;
    if (F.inc.size) {
      if (F.any) { let ok = false; for (const f of F.inc) if (r.fams.has(f)) { ok = true; break; } if (!ok) return false; }
      else for (const f of F.inc) if (!r.fams.has(f)) return false;
    }
    for (const t of F.flav) if (!r.tags.has(t)) return false;
    for (const q of F.quick) {
      if (q === 'must' && !r.must) return false;
      if (q === 'fav' && !favs.has(r.id)) return false;
      if (q === 'frozen' && !r.frozen) return false;
      if (q === 'coconut' && !r.tags.has('coconut')) return false;
      if (q === 'zero' && !r.zero) return false;
      if (q === 'untried' && tried[r.id]) return false;
    }
    for (const t of tokens) if (!r.search.includes(t)) return false;
    return true;
  }
  function results() {
    const tokens = C.norm(F.q).split(/\s+/).filter(Boolean);
    const out = recipes.filter(r => matches(r, tokens));
    const by = {
      az: (a, b) => a.name.localeCompare(b.name),
      strong: (a, b) => b.std - a.std || a.name.localeCompare(b.name),
      light: (a, b) => a.std - b.std || a.name.localeCompare(b.name),
      must: (a, b) => ((b.must ? 1 : 0) - (a.must ? 1 : 0)) || ((b.tags.has('pop') ? 1 : 0) - (a.tags.has('pop') ? 1 : 0)) || a.name.localeCompare(b.name),
      rated: (a, b) => ((tried[b.id] || {}).rating || 0) - ((tried[a.id] || {}).rating || 0) || a.name.localeCompare(b.name)
    };
    if (tokens.length && F.sort === 'az') {
      const q = C.norm(F.q);
      out.sort((a, b) => (C.norm(b.name).startsWith(q) - C.norm(a.name).startsWith(q)) || (C.norm(b.name).includes(q) - C.norm(a.name).includes(q)) || a.name.localeCompare(b.name));
    } else out.sort(by[F.sort] || by.az);
    return out;
  }
  let current = [], shown = 0, observer = null;
  function renderBrowse(opt) {
    if (opt && opt.reset) { F.cats.clear(); F.inc.clear(); F.exc.clear(); F.flav.clear(); F.str.clear(); F.quick.clear(); F.q = ''; }
    if (opt && opt.quick) F.quick.add(opt.quick);
    if (opt && opt.inc) F.inc.add(opt.inc);
    const catCount = {};
    recipes.forEach(r => { catCount[r.cat] = (catCount[r.cat] || 0) + 1; });
    $('#v-browse').innerHTML = `
      <div class="searchbar">
        <div class="search">
          <label>${I.search}<span class="sr">Search drinks</span><input id="q" type="search" placeholder="Search drinks or ingredients" value="${esc(F.q)}" autocomplete="off" enterkeyhint="search"></label>
          <button class="btn filter-btn" type="button" data-act="filters" aria-label="Filters">${I.sliders}<span>Filters</span>${filterCount() ? `<span class="badge">${filterCount()}</span>` : ''}</button>
        </div>
        <div class="chips" role="group" aria-label="Style">
          <button class="chip" type="button" data-act="cat" data-k="" aria-pressed="${!F.cats.size}">All <span class="n">${TOTAL}</span></button>
          ${Object.entries(C.CATS).map(([k, l]) => `<button class="chip" type="button" data-act="cat" data-k="${k}" aria-pressed="${F.cats.has(k)}">${esc(l)} <span class="n">${catCount[k] || 0}</span></button>`).join('')}
        </div>
        <div class="chips" role="group" aria-label="Quick filters">
          ${QUICK.map(([k, l]) => `<button class="chip" type="button" data-act="quick" data-k="${k}" aria-pressed="${F.quick.has(k)}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="result-bar">
        <p><b id="count">0</b> <span class="muted">drinks</span></p>
        <label class="sr" for="sort">Sort</label>
        <select id="sort">
          ${[['az', 'A to Z'], ['must', 'Must-try first'], ['light', 'Lightest first'], ['strong', 'Strongest first'], ['rated', 'My top rated']].map(([k, l]) => `<option value="${k}" ${F.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="active-filters" id="active"></div>
      <div class="rows" id="results"></div>
      <div class="more-sentinel" id="more">Loading more…</div>`;
    const q = $('#q');
    let tmr;
    q.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { F.q = q.value; renderResults(); }, 120); });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') q.blur(); });
    $('#sort').addEventListener('change', e => { F.sort = e.target.value; renderResults(); });
    renderResults();
  }
  function renderActive() {
    const el = $('#active');
    if (!el) return;
    const parts = [];
    F.inc.forEach(f => parts.push(`<button class="chip inc" type="button" data-act="rm" data-t="inc" data-k="${esc(f)}">With ${esc(f)} ${I.x}</button>`));
    F.exc.forEach(f => parts.push(`<button class="chip exc" type="button" data-act="rm" data-t="exc" data-k="${esc(f)}">${esc(f)} ${I.x}</button>`));
    F.flav.forEach(f => parts.push(`<button class="chip inc" type="button" data-act="rm" data-t="flav" data-k="${f}">${esc(C.FLAVOR_LABELS[f])} ${I.x}</button>`));
    F.str.forEach(f => parts.push(`<button class="chip inc" type="button" data-act="rm" data-t="str" data-k="${f}">${esc(C.STRENGTH[f])} ${I.x}</button>`));
    if (parts.length) parts.push('<button class="linkish" type="button" data-act="clear-filters">Clear all</button>');
    el.innerHTML = parts.join('');
    el.hidden = !parts.length;
  }
  function renderResults() {
    current = results();
    shown = 0;
    const cnt = $('#count'); if (!cnt) return;
    cnt.textContent = current.length;
    renderActive();
    const list = $('#results');
    list.innerHTML = current.length ? '' : `<div class="empty"><p>No drinks match all of that.</p><button class="btn small" type="button" data-act="clear-filters">Clear filters</button></div>`;
    appendMore();
    const fb = $('.filter-btn');
    if (fb) { const n = filterCount(); const b = fb.querySelector('.badge'); if (n) { if (b) b.textContent = n; else fb.insertAdjacentHTML('beforeend', `<span class="badge">${n}</span>`); } else if (b) b.remove(); }
    if (observer) observer.disconnect();
    const more = $('#more');
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) appendMore(); }, { rootMargin: '600px' });
      observer.observe(more);
    }
  }
  function appendMore() {
    const list = $('#results'); if (!list) return;
    const next = current.slice(shown, shown + 40);
    list.insertAdjacentHTML('beforeend', next.map(rowHTML).join(''));
    shown += next.length;
    const more = $('#more');
    if (more) {
      more.innerHTML = shown < current.length ? `<button class="btn small" type="button" data-act="more">Show more (${current.length - shown} left)</button>` : (current.length ? `<span>That's all ${current.length}.</span>` : '');
    }
  }

  function openFilters() {
    const groups = {};
    Object.keys(famCount).forEach(f => {
      if (HIDE_FAMS.has(f)) return;
      const g = famGroup[f] || 'accent';
      (groups[g] = groups[g] || []).push(f);
    });
    const order = Object.keys(C.GROUPS);
    const chip = f => {
      const st = F.inc.has(f) ? 'inc' : F.exc.has(f) ? 'exc' : '';
      return `<button class="chip ${st}" type="button" data-act="ing" data-k="${esc(f)}" data-name="${esc(C.norm(f))}">${esc(f)} <span class="n">${famCount[f]}</span></button>`;
    };
    const html = `<div class="panel" role="dialog" aria-modal="true" aria-label="Filters">
      <div class="panel-bar"><button class="btn small ghost" type="button" data-act="clear-filters-sheet">Reset</button><span class="grab"></span><button class="btn small sea" type="button" data-act="close">Show <span id="f-count">${current.length}</span></button></div>
      <h3>Strength</h3>
      <div class="chips wrap">${[0, 1, 2, 3, 4].map(k => `<button class="chip" type="button" data-act="str" data-k="${k}" aria-pressed="${F.str.has(k)}">${C.STRENGTH[k]}</button>`).join('')}</div>
      <h3>Flavor</h3>
      <div class="chips wrap">${FLAVORS.filter(t => tagCount[t]).map(t => `<button class="chip" type="button" data-act="flav" data-k="${t}" aria-pressed="${F.flav.has(t)}">${C.FLAVOR_LABELS[t]} <span class="n">${tagCount[t]}</span></button>`).join('')}</div>
      <h3>Ingredients</h3>
      <p class="muted" style="font-size:14px">Tap once to require it, twice to avoid it, three times to clear.</p>
      <div class="btn-row" style="margin:10px 0">
        <div class="seg" role="group" aria-label="Match"><button type="button" data-act="anyall" data-k="all" aria-pressed="${!F.any}">Must have all</button><button type="button" data-act="anyall" data-k="any" aria-pressed="${F.any}">Any of them</button></div>
      </div>
      <div class="search" style="margin-bottom:10px"><label>${I.search}<span class="sr">Find an ingredient</span><input id="ing-q" type="search" placeholder="Find an ingredient (e.g. coconut, mint)" autocomplete="off"></label></div>
      <div id="ing-groups">${order.filter(g => groups[g]).map(g => `<div class="ing-group" data-g="${g}"><p class="eyebrow" style="margin:14px 0 8px">${esc(C.GROUPS[g])}</p><div class="chips wrap">${groups[g].sort((a, b) => famCount[b] - famCount[a]).map(chip).join('')}</div></div>`).join('')}</div>
    </div>`;
    const el = openOverlay(html, { onClose: () => { if (view === 'browse') renderResults(); } });
    const iq = $('#ing-q', el);
    iq.addEventListener('input', () => {
      const v = C.norm(iq.value.trim());
      $$('.ing-group', el).forEach(g => {
        let any = false;
        $$('.chip', g).forEach(c => { const ok = !v || c.dataset.name.includes(v); c.hidden = !ok; any = any || ok; });
        g.hidden = !any;
      });
    });
  }
  function updateFilterSheet() {
    const n = results().length;
    const fc = $('#f-count'); if (fc) fc.textContent = n;
  }

  // ---------- DETAIL ----------
  const BARS = ['', 'Martini Bar', 'Pool deck', 'Sunset Bar', 'Solarium', 'Café al Bacio', 'Cellar Masters', 'Ensemble Lounge', 'Sky Observation Lounge', 'The Lawn Club', 'Main Dining Room', 'Specialty restaurant', 'Ashore', 'Other'];
  function openDrink(id, replace) {
    const r = byId.get(id); if (!r) return;
    const t = tried[r.id] || {};
    const rating = t.rating || 0;
    const ings = r.items.map(it => {
      const f = C.fmtItem(it, ING, S.units);
      return `<li><span class="amt">${esc(f.amt)}</span><span>${esc(f.name)}${f.mod ? ` <span class="mod">(${esc(f.mod)})</span>` : ''}${f.opt ? ' <span class="opt">optional</span>' : ''}</span><span class="ml">${esc(f.ml)}</span></li>`;
    }).join('');
    const steps = C.steps(r, ING, S.units).map(s => `<li>${esc(s)}</li>`).join('');
    const sim = C.similar(r, recipes, 6);
    const html = `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="dt-name">
      <div class="panel-bar"><span style="width:40px"></span><span class="grab"></span><button class="icon-btn" type="button" data-act="close" aria-label="Close">${I.x}</button></div>
      <div class="dt-head">${glassSVG(r, 96)}<div>
        <p class="eyebrow">${esc(C.CATS[r.cat])}${r.zero ? '' : ' · ' + esc(r.base)}</p>
        <h2 id="dt-name">${esc(r.name)}</h2>
        <p class="dt-meta">${dots(r)}<span>${r.zero ? (r.std > 0.01 ? 'Trace alcohol' : 'No alcohol') : `${C.STRENGTH[r.strength]} · ≈${r.std.toFixed(1)} standard drinks`}</span><span>${esc(C.METHODS[r.method])}</span></p>
      </div></div>
      <div class="tagline">${tagList(r).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>
      ${r.must ? `<p class="must-note"><b>★ Must-try.</b> ${esc(r.mustWhy)}</p>` : ''}
      <p class="know ${r.tags.has('pop') ? '' : 'rare'}"><i></i>${r.tags.has('pop') ? 'Most bartenders know this one by name.' : 'Less common. Show the bartender this recipe.'}</p>
      <div class="dt-actions">
        <button class="btn primary wide" type="button" data-act="bartender" data-id="${r.id}">${I.card}Show the bartender</button>
        <button class="btn ${favs.has(r.id) ? 'on' : ''}" type="button" data-act="fav" data-id="${r.id}" aria-pressed="${favs.has(r.id)}">${favs.has(r.id) ? I.heartF : I.heart}<span>${favs.has(r.id) ? 'Saved' : 'Save'}</span></button>
        <button class="btn" type="button" data-act="log" data-id="${r.id}">${I.glassPlus}Log one</button>
      </div>
      ${r.note ? `<p class="dt-note">${esc(r.note)}</p>` : ''}
      <h3>Ingredients</h3>
      <ul class="ing">${ings}</ul>
      <h3>How to make it</h3>
      <ol class="steps">${steps}</ol>
      <dl class="facts"><dt>Glass</dt><dd>${esc(C.GLASSES[r.glass])}</dd>${r.garnish ? `<dt>Garnish</dt><dd>${esc(r.garnish)}</dd>` : ''}</dl>
      <div class="say"><p class="eyebrow">Say it like this</p><p>“${esc(C.orderLine(r, ING))}”</p></div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn small" type="button" data-act="copy" data-id="${r.id}">${I.copy}Copy recipe</button>
        <button class="btn small" type="button" data-act="units">Units: ${S.units === 'both' ? 'oz + ml' : S.units}</button>
      </div>
      <h3>My notes</h3>
      <div class="rate">
        <div class="stars" role="group" aria-label="My rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= rating ? 'on' : ''}" data-act="rate" data-id="${r.id}" data-n="${n}" aria-label="${n} star${n > 1 ? 's' : ''}" aria-pressed="${n <= rating}">${I.star}</button>`).join('')}</div>
        <label class="field" for="note-${r.id}">Note<textarea id="note-${r.id}" placeholder="What did you think? Any tweaks, like less sweet or extra lime?">${esc(t.note || '')}</textarea></label>
        <label class="field" for="bar-${r.id}">Where you had it<select id="bar-${r.id}">${BARS.map(b => `<option value="${esc(b)}" ${t.bar === b ? 'selected' : ''}>${b ? esc(b) : 'Choose a spot'}</option>`).join('')}</select></label>
        <p class="saved-hint" id="saved-${r.id}" aria-live="polite"></p>
      </div>
      <h3>You might also like</h3>
      <div class="rows">${sim.map(rowHTML).join('')}</div>
    </div>`;
    const el = openOverlay(html, { replace, onClose: () => afterSheet(r.id) });
    el.dataset.drink = r.id;
    const note = $(`#note-${r.id}`, el), bar = $(`#bar-${r.id}`, el), hint = $(`#saved-${r.id}`, el);
    let tm;
    const saveNote = () => {
      const cur = tried[r.id] || { rating: 0, ts: Date.now() };
      cur.note = note.value; cur.bar = bar.value;
      if (!cur.rating && !cur.note && !cur.bar) delete tried[r.id]; else tried[r.id] = cur;
      saveTried(); hint.textContent = 'Saved on this phone';
    };
    note.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(saveNote, 400); });
    bar.addEventListener('change', saveNote);
  }

  function afterSheet(id) {
    if (view === 'home' || view === 'mybar') { refresh(); return; }
    updateRows(id);
  }
  function updateRows(id) {
    const r = byId.get(id); if (!r) return;
    $$('.view .row[data-id="' + id + '"]').forEach(el => {
      if (el.dataset.kind === 'must') el.outerHTML = mustRow(r);
      else if (!el.dataset.kind) el.outerHTML = rowHTML(r);
    });
  }
  function setRating(id, n) {
    const cur = tried[id] || { note: '', bar: '', ts: Date.now() };
    cur.rating = cur.rating === n ? 0 : n;
    cur.ts = Date.now();
    tried[id] = cur;
    if (!cur.rating && !cur.note && !cur.bar) delete tried[id];
    saveTried();
    const el = stack.length && stack[stack.length - 1].el;
    if (el) $$('.stars button', el).forEach(b => { const on = +b.dataset.n <= (cur.rating || 0); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const h = el && $(`#saved-${id}`, el); if (h) h.textContent = cur.rating ? `Rated ${cur.rating} of 5` : 'Rating cleared';
  }
  function toggleFav(id, btn) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs();
    const on = favs.has(id);
    if (btn) { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); btn.innerHTML = `${on ? I.heartF : I.heart}<span>${on ? 'Saved' : 'Save'}</span>`; }
    toast(on ? 'Saved to My Bar' : 'Removed from saved');
  }

  // ---------- BARTENDER CARD ----------
  let wakeLock = null;
  function openBartender(id) {
    const r = byId.get(id); if (!r) return;
    const draw = el => {
      const rows = r.items.map(it => {
        const f = C.fmtItem(it, ING, S.units);
        return `<tr><td class="a">${esc(f.amt)}${f.ml ? `<small>${esc(f.ml)}</small>` : ''}</td><td>${esc(f.name)}${f.mod ? ` (${esc(f.mod)})` : ''}${f.opt ? ' <small>optional</small>' : ''}</td></tr>`;
      }).join('');
      el.querySelector('.bt-in').innerHTML = `
        <div class="bt-top">
          <div class="seg" role="group" aria-label="Units">${[['both', 'oz + ml'], ['oz', 'oz'], ['ml', 'ml']].map(([k, l]) => `<button type="button" data-act="bt-units" data-k="${k}" data-id="${r.id}" aria-pressed="${S.units === k}">${l}</button>`).join('')}</div>
          <button class="bt-close" type="button" data-act="close" data-autofocus>Done</button>
        </div>
        <p class="bt-ask">Could you make this, please?</p>
        <h2 class="bt-name">${esc(r.name)}</h2>
        <p class="bt-sub">${esc(C.METHODS[r.method])} · ${esc(C.GLASSES[r.glass])}</p>
        <table class="bt-ing"><tbody>${rows}</tbody></table>
        <ol class="bt-steps">${C.steps(r, ING, S.units).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        ${r.garnish ? `<p class="bt-garnish"><b>Garnish:</b> ${esc(r.garnish)}</p>` : ''}
        <p class="bt-thanks">Thank you!</p>`;
    };
    const el = openOverlay('<div class="bt-in"></div>', { cls: 'bt', noScrimClose: true, onClose: releaseWake });
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Recipe card for the bartender');
    el._draw = () => draw(el);
    draw(el);
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wakeLock = w; }).catch(() => {}); } catch (e) { /* ignore */ }
  }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }

  // ---------- SURPRISE ----------
  function surprisePool(mode) {
    let pool;
    switch (mode) {
      case 'frozen': pool = recipes.filter(r => r.frozen && !r.zero); break;
      case 'tropical': pool = recipes.filter(r => r.tags.has('tropical') && !r.zero); break;
      case 'coconut': pool = recipes.filter(r => r.tags.has('coconut') && !r.zero); break;
      case 'zero': pool = recipes.filter(r => r.zero && r.cat !== 'coffee'); break;
      case 'new': pool = recipes.filter(r => !tried[r.id] && !r.zero && r.cat !== 'coffee'); break;
      default: pool = recipes.filter(r => !r.zero && !['coffee'].includes(r.cat));
    }
    return pool.length ? pool : recipes;
  }
  function openSurprise(mode, replace) {
    mode = mode || surpriseMode;
    const pool = surprisePool(mode);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const label = (SURPRISE_MODES.find(m => m[0] === mode) || [])[1] || 'Anything';
    const html = `<div class="spin-panel" role="dialog" aria-modal="true" aria-label="Surprise drink">
      <p class="eyebrow">Spinning the bar · ${esc(label)}</p>
      <div class="reel" aria-hidden="true"><span id="reel-name">…</span></div>
      <div class="spin-result" id="spin-result" hidden></div>
    </div>`;
    const el = openOverlay(html, { cls: 'overlay spin-overlay', noFocus: true, replace, onClose: () => { if (view === 'home') renderHome(); } });
    el.dataset.spin = '1';
    const reel = $('#reel-name', el);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      $('.reel', el).hidden = true;
      const res = $('#spin-result', el);
      res.hidden = false;
      res.innerHTML = `${glassSVG(pick, 110)}<h2>${esc(pick.name)}</h2><p>${esc(summary(pick, 5))}</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn primary" type="button" data-act="open-from-spin" data-id="${pick.id}" data-autofocus>See the recipe</button>
          <button class="btn" type="button" data-act="respin" data-k="${mode}">${I.dice}Spin again</button>
          <button class="btn" type="button" data-act="close">Close</button>
        </div>`;
      const b = res.querySelector('[data-autofocus]'); if (b) b.focus({ preventScroll: true });
    };
    if (reduce) { finish(); return; }
    const start = performance.now(), dur = 1500;
    let last = 0;
    const tick = now => {
      if (!el.isConnected) return;
      const p = Math.min(1, (now - start) / dur);
      const interval = 40 + 260 * p * p;
      if (now - last > interval) { last = now; reel.textContent = pool[Math.floor(Math.random() * pool.length)].name; }
      if (p < 1) requestAnimationFrame(tick);
      else { reel.textContent = pick.name; setTimeout(finish, 260); }
    };
    requestAnimationFrame(tick);
  }

  // ---------- QUIZ ----------
  const QUIZ = [
    { id: 'mood', q: 'How are you feeling right now?', opts: [
      { k: 'chill', e: '😌', t: 'Chill and lazy', w: { tropical: 2, creamy: 1.5, frozen: 1.5, sweet: 1, coconut: 1 } },
      { k: 'party', e: '🥳', t: 'Ready to party', w: { fun: 3, bubbly: 1, sweet: 1, fruity: 1 }, shift: 0.5, shots: true },
      { k: 'romance', e: '🥰', t: 'Romantic', w: { elegant: 3, bubbly: 2, berry: 1, floral: 1.5 } },
      { k: 'tired', e: '🥱', t: 'Tired, need a boost', w: { coffee: 5, choc: 1 }, coffee: true },
      { k: 'hot', e: '🥵', t: 'Hot and sun-baked', w: { fresh: 3, citrus: 2, frozen: 2, minty: 1.5 }, shift: -0.5 },
      { k: 'rough', e: '🤕', t: 'A little rough', w: { fresh: 2, ginger: 3, savory: 1.5, citrus: 1 }, shift: -1 }
    ] },
    { id: 'where', q: 'Where are you?', opts: [
      { k: 'pool', e: '☀️', t: 'Pool deck or beach', w: { frozen: 2.5, tropical: 2.5, fresh: 1, coconut: 1 } },
      { k: 'sunset', e: '🌅', t: 'Sunset or sail-away', w: { bubbly: 1.5, bitter: 1.5, fruity: 1, elegant: 1, citrus: 0.5 } },
      { k: 'pre', e: '🍽️', t: 'Before dinner', w: { dry: 2, bitter: 2, bubbly: 1.5, elegant: 1.5, citrus: 1 }, cats: { martini: 1, classic: 1, bubbly: 1 } },
      { k: 'post', e: '🍰', t: 'After dinner', w: { dessert: 2.5, coffee: 2, creamy: 1.5, nutty: 1.5, choc: 1.5 } },
      { k: 'lounge', e: '🎷', t: 'Show, lounge or casino', w: { elegant: 1.5 }, cats: { martini: 2, classic: 1.5 } },
      { k: 'late', e: '🌙', t: 'Late night', w: { fun: 2, coffee: 1, dessert: 1 }, shots: true }
    ] },
    { id: 'flavor', q: 'What sounds good?', opts: [
      { k: 'fruity', e: '🍍', t: 'Fruity and tropical', w: { fruity: 3, tropical: 3 } },
      { k: 'tart', e: '🍋', t: 'Tart and citrusy', w: { tart: 3, citrus: 3 } },
      { k: 'creamy', e: '🍫', t: 'Creamy and sweet', w: { creamy: 3, dessert: 2, sweet: 2 } },
      { k: 'fresh', e: '🌿', t: 'Fresh and herbal', w: { fresh: 2, minty: 2.5, herbal: 2.5 } },
      { k: 'bitter', e: '🍊', t: 'Bittersweet', w: { bitter: 3.5, dry: 2 } },
      { k: 'bubbly', e: '🥂', t: 'Bubbly', w: { bubbly: 4 } },
      { k: 'coffee', e: '☕', t: 'Coffee or chocolate', w: { coffee: 3.5, choc: 3 }, coffee: true },
      { k: 'spicy', e: '🌶️', t: 'Spicy or smoky', w: { spicy: 3.5, smoky: 3, ginger: 1.5 } }
    ] },
    { id: 'strength', q: 'How strong?', opts: [
      { k: '0', e: '🚫', t: 'Zero-proof', target: 0 },
      { k: '1', e: '🌤️', t: 'Light and easy', target: 1 },
      { k: '2', e: '🍹', t: 'Normal', target: 2 },
      { k: '3', e: '💪', t: 'Make it count', target: 3 }
    ] },
    { id: 'spirit', q: 'Any spirit in mind?', skip: a => a.strength === '0', opts: [
      { k: 'any', e: '🎲', t: 'Surprise me' },
      { k: 'tequila', e: '🌵', t: 'Tequila or mezcal', fams: ['Tequila', 'Mezcal'] },
      { k: 'rum', e: '🏝️', t: 'Rum', fams: ['Rum', 'Cachaça', 'Coconut rum'] },
      { k: 'vodka', e: '🧊', t: 'Vodka', fams: ['Vodka'] },
      { k: 'gin', e: '🌲', t: 'Gin', fams: ['Gin', 'Sloe gin'] },
      { k: 'wine', e: '🍷', t: 'Wine, bubbly or beer', fams: ['Sparkling wine', 'White wine', 'Red wine', 'Rosé wine', 'Vermouth', 'Sherry', 'Port', 'Lillet', 'Beer', 'Cider'] },
      { k: 'other', e: '🥃', t: 'Brandy, pisco or liqueur', fams: ['Brandy & cognac', 'Pisco', 'Grappa', 'Guaro', 'Absinthe & anise', 'Amaretto', 'Coffee liqueur', 'Irish cream', 'Orange liqueur', 'Aperol', 'Campari', 'Limoncello', 'Melon liqueur', 'Crème de menthe', 'Chocolate liqueur', 'Licor 43', 'Peach schnapps'] }
    ] }
  ];
  const quiz = { step: 0, ans: {}, seed: Date.now(), result: null };
  function quizOpt(id) { const q = QUIZ.find(x => x.id === id); return q && q.opts.find(o => o.k === quiz.ans[id]); }
  function scoreAll() {
    const r0 = rng(quiz.seed);
    const jitter = {};
    recipes.forEach(r => { jitter[r.id] = r0(); });
    const mood = quizOpt('mood') || {}, where = quizOpt('where') || {}, flavor = quizOpt('flavor') || {}, str = quizOpt('strength') || {}, sp = quizOpt('spirit') || {};
    const weights = {};
    [mood, where, flavor].forEach(o => Object.entries(o.w || {}).forEach(([k, v]) => { weights[k] = (weights[k] || 0) + v; }));
    const cats = Object.assign({}, where.cats || {});
    const allowShots = !!(mood.shots || where.shots);
    const wantCoffee = !!(mood.coffee || flavor.coffee);
    const target = str.target == null ? 2 : str.target;
    const goal = Math.max(1, Math.min(4, target + (mood.shift || 0)));
    const out = [];
    for (const r of recipes) {
      if (target === 0 ? !r.zero : r.zero) continue;
      if (r.cat === 'shot' && !allowShots) continue;
      if (r.cat === 'coffee' && r.zero && !wantCoffee) continue;
      let s = 0;
      const why = [];
      for (const [t, w] of Object.entries(weights)) if (r.tags.has(t)) { s += w; why.push([w, t]); }
      s = s / Math.sqrt(Math.max(3, r.tags.size)) * 1.6;
      if (cats[r.cat]) s += cats[r.cat];
      if (target > 0) s -= Math.abs(r.strength - goal) * 1.6;
      if (sp.fams) {
        if (sp.fams.includes(r.base)) s += 4;
        else if ([...r.fams].some(f => sp.fams.includes(f))) s += 1;
        else s -= 4;
      }
      if (r.must) s += 0.8;
      if (r.tags.has('pop')) s += 0.4;
      if (favs.has(r.id)) s += 0.6;
      const t = tried[r.id];
      if (t && t.rating >= 4) s += 1; else if (t && t.rating && t.rating <= 2) s -= 4;
      if (r.tags.has('coconut')) s += 0.5;
      s += jitter[r.id] * 1.4;
      why.sort((a, b) => b[0] - a[0]);
      out.push({ r, s, why: why.slice(0, 3).map(x => C.FLAVOR_LABELS[x[1]]) });
    }
    out.sort((a, b) => b.s - a.s);
    return out.slice(0, 5);
  }
  function renderQuiz() {
    const el = $('#v-quiz');
    const steps = QUIZ.filter(q => !(q.skip && q.skip(quiz.ans)));
    if (quiz.result) {
      const [top, ...rest] = quiz.result;
      const picked = QUIZ.map(q => quizOpt(q.id)).filter(Boolean).map(o => o.t);
      el.innerHTML = `
        <div class="match">
          ${glassSVG(top.r, 88)}
          <div><p class="eyebrow">Your match</p><h2>${esc(top.r.name)}</h2><p>${esc(summary(top.r, 5))}</p></div>
          <div class="why" style="grid-column:1/-1">${top.why.concat(top.r.zero ? ['Zero-proof'] : [C.STRENGTH[top.r.strength]]).map(w => `<span>${esc(w)}</span>`).join('')}</div>
          <div class="btn-row">
            <button class="btn primary" type="button" data-act="open" data-id="${top.r.id}">See the recipe</button>
            <button class="btn" type="button" data-act="bartender" data-id="${top.r.id}">${I.card}Bartender card</button>
          </div>
        </div>
        <section>
          <div class="section-head"><h2>Also great right now</h2><button class="linkish" type="button" data-act="quiz-shuffle">Shuffle</button></div>
          <div class="rows" style="margin-top:10px">${rest.map(x => rowHTML(x.r)).join('')}</div>
        </section>
        <p class="muted" style="font-size:14px">You said: ${esc(picked.join(' · '))}</p>
        <div class="btn-row"><button class="btn" type="button" data-act="quiz-restart">Retake the quiz</button><button class="btn ghost" type="button" data-act="quiz-back">Change last answer</button></div>`;
      return;
    }
    const q = steps[Math.min(quiz.step, steps.length - 1)];
    const idx = steps.indexOf(q);
    el.innerHTML = `
      <div class="quiz-card">
        <div class="progress" aria-label="Question ${idx + 1} of ${steps.length}">${steps.map((s, i) => `<i class="${i <= idx ? 'f' : ''}"></i>`).join('')}</div>
        <p class="eyebrow">Mood match · question ${idx + 1} of ${steps.length}</p>
        <h2 class="quiz-q">${esc(q.q)}</h2>
        <div class="answers" role="group" aria-label="${esc(q.q)}">
          ${q.opts.map(o => `<button class="answer" type="button" data-act="answer" data-q="${q.id}" data-k="${o.k}" aria-pressed="${quiz.ans[q.id] === o.k}"><span class="e" aria-hidden="true">${o.e}</span><span>${esc(o.t)}</span></button>`).join('')}
        </div>
        <div class="btn-row">${idx > 0 ? `<button class="btn small" type="button" data-act="quiz-prev">${I.left}Back</button>` : ''}${Object.keys(quiz.ans).length ? '<button class="btn small ghost" type="button" data-act="quiz-restart">Start over</button>' : ''}</div>
      </div>`;
  }
  function answer(qid, k) {
    quiz.ans[qid] = k;
    if (qid === 'strength' && k === '0') delete quiz.ans.spirit;
    const steps = QUIZ.filter(q => !(q.skip && q.skip(quiz.ans)));
    const idx = steps.findIndex(q => q.id === qid);
    if (idx >= steps.length - 1) { quiz.seed = Date.now(); quiz.result = scoreAll(); quiz.step = idx; }
    else quiz.step = idx + 1;
    renderQuiz();
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  // ---------- MY BAR ----------
  let barTab = 'today';
  let dayOffset = 0;
  function dayFromOffset(off) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
  function addLog(entry) {
    entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    entry.ts = entry.ts || Date.now();
    entry.p = S.person || 0;
    log.push(entry); saveLog();
    return entry;
  }
  function logDrink(id) {
    const r = byId.get(id); if (!r) return;
    const kind = priceKind(r);
    const e = addLog({ kind, rid: r.id, name: r.name, price: +S.prices[kind] || 0, std: +r.std.toFixed(2) });
    toast(`Logged for ${people()[S.person] || 'you'} · ≈${money(e.price)} value`, () => { log = log.filter(x => x.id !== e.id); saveLog(); if (view === 'mybar' || view === 'home') refresh(); });
    if (view === 'mybar' || view === 'home') refresh();
  }
  const QUICK_ADD = [
    ['water', 'Bottled water', 0], ['coffee', 'Specialty coffee', 0], ['soda', 'Soda', 0],
    ['beer', 'Beer', 1], ['wine', 'Glass of wine', 1]
  ];
  function renderMyBar(opt) {
    if (opt && opt.tab) barTab = opt.tab;
    const el = $('#v-mybar');
    const nFav = favs.size, nTried = Object.values(tried).filter(t => t.rating || t.note).length;
    let body = '';
    if (barTab === 'today') body = trackerHTML();
    else if (barTab === 'saved') {
      const list = recipes.filter(r => favs.has(r.id)).sort((a, b) => a.name.localeCompare(b.name));
      body = list.length ? `<div class="rows">${list.map(rowHTML).join('')}</div>` : `<div class="empty"><p>Nothing saved yet. Tap Save on any drink.</p></div>`;
    } else if (barTab === 'rated') {
      const list = Object.entries(tried).filter(([id, t]) => byId.has(id) && (t.rating || t.note)).sort((a, b) => (b[1].rating || 0) - (a[1].rating || 0) || b[1].ts - a[1].ts);
      body = list.length ? `<div class="rows">${list.map(([id, t]) => {
        const r = byId.get(id);
        return `<button class="row" type="button" data-act="open" data-id="${id}" data-kind="rated">${glassSVG(r, 44)}<span class="row-main"><span class="row-name">${esc(r.name)}</span><span class="row-sub" style="white-space:normal">${t.note ? esc(t.note) : 'No note'}${t.bar ? ' · ' + esc(t.bar) : ''}</span></span><span class="row-side"><span class="mk-must">${'★'.repeat(t.rating || 0)}${'☆'.repeat(5 - (t.rating || 0))}</span></span></button>`;
      }).join('')}</div>` : `<div class="empty"><p>Rate drinks from their recipe page to build your list.</p></div>`;
    } else body = shopHTML();
    el.innerHTML = `
      <div class="section-head"><h2 class="display" style="font-size:26px">My Bar</h2></div>
      <div class="seg full" role="group" aria-label="My Bar sections">
        ${[['today', 'Tracker'], ['saved', `Saved · ${nFav}`], ['rated', `Rated · ${nTried}`], ['shop', 'Home bar']].map(([k, l]) => `<button type="button" data-act="bartab" data-k="${k}" aria-pressed="${barTab === k}">${l}</button>`).join('')}
      </div>
      ${body}`;
  }
  function trackerHTML() {
    const ppl = people();
    if (S.person >= ppl.length) S.person = 0;
    const d = dayFromOffset(dayOffset), key = dayKey(d.getTime());
    const dayEntries = log.filter(e => dayKey(e.ts) === key).sort((a, b) => a.ts - b.ts);
    const mine = dayEntries.filter(e => (e.p || 0) === S.person);
    const alc = mine.filter(e => e.std >= 0.15);
    const water = mine.filter(e => e.kind === 'water').length;
    const std = alc.reduce((a, e) => a + (e.std || 0), 0);
    const value = mine.reduce((a, e) => a + (e.price || 0), 0);
    const pkg = parseFloat(S.pkg);
    const ahead = alc.length - water;
    const label = dayOffset === 0 ? 'Today' : dayOffset === -1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const otherDays = [...new Set(log.map(e => dayKey(e.ts)))].filter(k => k !== key).sort().reverse().slice(0, 10);
    return `
      <div class="chips" role="group" aria-label="Whose tab">${ppl.map((p, i) => `<button class="chip" type="button" data-act="person" data-i="${i}" aria-pressed="${S.person === i}">${esc(p)}</button>`).join('')}<button class="chip" type="button" data-act="settings">Edit names</button></div>
      <div class="daynav">
        <button class="icon-btn" type="button" data-act="day" data-d="-1" aria-label="Previous day">${I.left}</button>
        <b>${esc(label)}</b>
        <button class="icon-btn" type="button" data-act="day" data-d="1" aria-label="Next day" ${dayOffset >= 0 ? 'disabled' : ''}>${I.right}</button>
      </div>
      <div class="tally">
        <div><b>${alc.length}</b><span>drinks · ≈${std.toFixed(1)} std</span></div>
        <div><b>${water}</b><span>waters</span></div>
        <div><b>${money(value)}</b><span>est. menu value</span></div>
      </div>
      ${pkg > 0 ? `<div style="display:grid;gap:6px"><div class="meter" role="img" aria-label="Package value ${Math.round(value / pkg * 100)}%"><i style="width:${Math.min(100, value / pkg * 100)}%"></i></div><p class="muted" style="font-size:14px">${value >= pkg ? `Package paid off ${label === 'Today' ? 'today' : 'this day'}: about ${money(value - pkg)} ahead.` : `About ${money(pkg - value)} to break even on your ${money(pkg)}/day package.`}</p></div>` : `<p class="muted" style="font-size:14px">Add your daily package price in <button class="linkish" type="button" data-act="settings">Settings</button> to see your break-even.</p>`}
      ${dayOffset === 0 && ahead >= 2 ? `<div class="nudge"><span>You're ${ahead} drinks ahead of your water. Grab one?</span><button class="btn small" type="button" data-act="quickadd" data-k="water">${I.plus}Water</button></div>` : ''}
      <div>
        <p class="eyebrow" style="margin-bottom:8px">Quick add for ${esc(ppl[S.person])}</p>
        <div class="quick">
          <button class="btn primary" type="button" data-act="pick-drink">${I.glassPlus}Cocktail…</button>
          ${QUICK_ADD.map(([k, l]) => `<button class="btn" type="button" data-act="quickadd" data-k="${k}">${I.plus}${esc(l)}</button>`).join('')}
        </div>
      </div>
      <div>
        ${mine.length ? mine.map(e => {
          const r = e.rid && byId.get(e.rid);
          const t = new Date(e.ts);
          return `<div class="log-row"><time>${t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>${r ? glassSVG(r, 34) : '<span></span>'}<span class="nm">${r ? `<button class="linkish" type="button" data-act="open" data-id="${r.id}" style="color:var(--ink);font-weight:600">${esc(e.name)}</button>` : esc(e.name)}</span><span class="pr">≈${money(e.price || 0)}</span><button class="x" type="button" data-act="unlog" data-id="${e.id}" aria-label="Remove ${esc(e.name)}">${I.x}</button></div>`;
        }).join('') : `<p class="muted">Nothing logged ${dayOffset === 0 ? 'yet today' : 'this day'} for ${esc(ppl[S.person])}.</p>`}
      </div>
      ${ppl.length > 1 && dayEntries.length ? `<p class="muted" style="font-size:14px">Everyone ${dayOffset === 0 ? 'today' : 'that day'}: ${ppl.map((p, i) => { const es = dayEntries.filter(e => (e.p || 0) === i); return `${esc(p)} ${es.filter(e => e.std >= 0.15).length} drinks, ≈${money(es.reduce((a, e) => a + (e.price || 0), 0))}`; }).join(' · ')}</p>` : ''}
      ${otherDays.length ? `<div><p class="eyebrow" style="margin:6px 0 8px">Earlier days</p>${otherDays.map(k => { const es = log.filter(e => dayKey(e.ts) === k); const [y, m, dd] = k.split('-').map(Number); const dt = new Date(y, m - 1, dd, 12); const off = Math.round((dt - dayFromOffset(0)) / 864e5); return `<button class="row" type="button" data-act="goday" data-d="${off}" style="grid-template-columns:1fr auto"><span class="row-main"><span class="row-name">${dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span class="row-sub">${es.filter(e => e.std >= 0.15).length} drinks · ${es.filter(e => e.kind === 'water').length} waters</span></span><span class="row-side">≈${money(es.reduce((a, e) => a + (e.price || 0), 0))}</span></button>`; }).join('')}</div>` : ''}
      <p class="muted" style="font-size:13px">Values use estimated menu prices you can edit in Settings. Standard drink ≈ 0.6 oz of pure alcohol; estimates assume the recipe as written.</p>`;
  }
  function quickAdd(k) {
    const map = { water: ['Bottled water', 0], coffee: ['Specialty coffee', 0], soda: ['Soda', 0], beer: ['Beer', 1], wine: ['Glass of wine', 1] };
    const [name, std] = map[k];
    const e = addLog({ kind: k, name, price: +S.prices[k] || 0, std });
    toast(`${name} logged`, () => { log = log.filter(x => x.id !== e.id); saveLog(); refresh(); });
    refresh();
  }
  function openPicker() {
    const html = `<div class="panel" role="dialog" aria-modal="true" aria-label="Log a drink">
      <div class="panel-bar"><span class="eyebrow">Log a drink for ${esc(people()[S.person])}</span><button class="icon-btn" type="button" data-act="close" aria-label="Close">${I.x}</button></div>
      <div class="search" style="margin-bottom:10px"><label>${I.search}<span class="sr">Search</span><input id="pick-q" type="search" placeholder="Search all ${TOTAL} drinks" autocomplete="off" data-autofocus></label></div>
      <div class="rows" id="pick-list"></div></div>`;
    const el = openOverlay(html);
    const q = $('#pick-q', el), list = $('#pick-list', el);
    const draw = () => {
      const tokens = C.norm(q.value).split(/\s+/).filter(Boolean);
      let rs = tokens.length ? recipes.filter(r => tokens.every(t => r.search.includes(t))) : [...new Set([...log.slice().reverse().map(e => e.rid).filter(Boolean), ...favs])].map(id => byId.get(id)).filter(Boolean).concat(must.flatMap(m => m.items));
      rs = [...new Set(rs)].slice(0, 40);
      list.innerHTML = rs.map(r => `<button class="row" type="button" data-act="pick" data-id="${r.id}">${glassSVG(r, 40)}<span class="row-main"><span class="row-name">${esc(r.name)}</span><span class="row-sub">≈${money(+S.prices[priceKind(r)] || 0)} · ${r.zero ? 'zero-proof' : '≈' + r.std.toFixed(1) + ' std drinks'}</span></span><span class="row-side">${I.plus}</span></button>`).join('') || '<p class="muted" style="padding:12px 0">No match.</p>';
    };
    q.addEventListener('input', draw);
    draw();
  }
  function shopHTML() {
    const src = recipes.filter(r => favs.has(r.id) || (tried[r.id] && tried[r.id].rating >= 4));
    if (!src.length) return `<div class="empty"><p>Save or rate drinks 4★ and up, and their ingredients show up here as a shopping list for home.</p></div>`;
    const need = {};
    src.forEach(r => r.items.forEach(i => {
      if (i.opt) return;
      const ing = ING[i.key];
      if (['Water', 'Sugar'].includes(ing.fam)) return;
      (need[ing.fam] = need[ing.fam] || { group: ing.group, drinks: new Set() }).drinks.add(r.name);
    }));
    const groups = {};
    Object.entries(need).forEach(([f, v]) => { (groups[v.group] = groups[v.group] || []).push([f, v]); });
    const lines = [];
    const html = Object.keys(C.GROUPS).filter(g => groups[g]).map(g => {
      lines.push(C.GROUPS[g].toUpperCase());
      return `<div class="shop-group"><p class="eyebrow" style="margin:14px 0 4px">${esc(C.GROUPS[g])}</p>${groups[g].sort((a, b) => b[1].drinks.size - a[1].drinks.size).map(([f, v]) => {
        lines.push('- ' + f);
        const done = shop.has(f);
        return `<label class="shop-item ${done ? 'done' : ''}"><input type="checkbox" data-act="shopcheck" data-k="${esc(f)}" ${done ? 'checked' : ''}><span>${esc(f)}</span><small>${v.drinks.size} drink${v.drinks.size > 1 ? 's' : ''}</small></label>`;
      }).join('')}</div>`;
    }).join('');
    shopText = 'Sip & Sail home bar list\n\n' + lines.join('\n');
    return `<p class="muted">Everything you need to make your ${src.length} saved and top-rated drinks at home after the cruise.</p>${html}<div class="btn-row" style="margin-top:12px"><button class="btn small" type="button" data-act="copy-shop">${I.copy}Copy list</button></div>`;
  }
  let shopText = '';

  // ---------- GUIDE ----------
  const PORTS = [
    { region: 'Mediterranean & Europe', note: 'Celebrity Equinox sails the Mediterranean from Barcelona, Lisbon and Rome in fall 2026.', places: [
      { name: 'Spain', where: 'Barcelona · Valencia · Málaga · Palma · Cartagena · Cádiz for Seville', items: [
        ['Cava', 'Catalonia\'s sparkling wine. Order a copa in Barcelona.'],
        ['Vermut', 'Barcelona\'s pre-lunch ritual, "la hora del vermut."', 'Vermut'],
        ['Tinto de Verano', 'What locals actually drink in summer: red wine and lemon soda.', 'Tinto de Verano'],
        ['Agua de Valencia', 'Valencia\'s Cava, orange, gin and vodka.', 'Agua de Valencia'],
        ['Rebujito', 'Seville\'s fair drink: sherry and lemon-lime soda.', 'Rebujito'],
        ['Kalimotxo', 'Basque red wine and cola.', 'Kalimotxo'],
        ['Carajillo', 'Licor 43 was born in Cartagena; add espresso.', 'Carajillo'],
        ['Spanish Gin Tonic', 'Huge copa glass, lots of ice, aromatic garnish.', 'Spanish Gin Tonic']
      ] },
      { name: 'Italy', where: 'Rome (Civitavecchia) · Naples · Florence and Pisa (Livorno) · La Spezia · Genoa · Sicily', items: [
        ['Aperol Spritz', 'The Veneto\'s sunset classic, everywhere in Italy.', 'Aperol Spritz'],
        ['Negroni', 'Born in Florence in 1919.', 'Negroni'],
        ['Negroni Sbagliato', 'Milan\'s "mistaken" Negroni with prosecco.', 'Negroni Sbagliato'],
        ['Bellini & Rossini', 'Venice, Harry\'s Bar.', 'Bellini'],
        ['Limoncello', 'Amalfi, Sorrento and Capri lemons, ice-cold after dinner.', 'Limoncello'],
        ['Sambuca con la Mosca', 'A Roman after-dinner ritual with three coffee beans.', 'Sambuca con la Mosca'],
        ['Caffè Corretto', 'Espresso "corrected" with grappa or sambuca.', 'Caffè Corretto'],
        ['Crodino', 'The zero-proof aperitivo in a tiny bottle.', 'Crodino Spritz']
      ] },
      { name: 'France & Monaco', where: 'Marseille and Provence · Nice and Villefranche · Monte Carlo · Corsica', items: [
        ['Pastis', 'Marseille\'s anise aperitif with cold water.', 'Pastis'],
        ['Kir & Kir Royale', 'Burgundy\'s blackcurrant classics.', 'Kir Royale'],
        ['Provence rosé', 'Pale, dry and perfect at a café table.'],
        ['French 75', 'Paris, Harry\'s New York Bar.', 'French 75'],
        ['Monaco', 'A pink beer shandy with grenadine.', 'Monaco']
      ] },
      { name: 'Greece', where: 'Athens (Piraeus) · Mykonos · Santorini · Rhodes · Crete · Corfu', items: [
        ['Ouzo', 'Add water and ice; it turns milky. Sip with meze.', 'Ouzo & Water'],
        ['Mastiha', 'Chios\'s piney liqueur, ice-cold.', 'Mastiha on Ice'],
        ['Tsikoudia (raki)', 'Crete\'s grape spirit, often a free shot after dinner.'],
        ['Assyrtiko', 'Santorini\'s crisp, mineral white wine.'],
        ['Freddo Espresso', 'The Greek summer coffee.', 'Freddo Espresso'],
        ['Frappé', 'Foamy shaken instant coffee from Thessaloniki.', 'Greek Frappé']
      ] },
      { name: 'Portugal & Madeira', where: 'Lisbon · Porto (Leixões) · Funchal', items: [
        ['White Port & Tonic', 'Porto\'s summer aperitif.', 'White Port & Tonic'],
        ['Ginjinha', 'Lisbon\'s sour-cherry liqueur, sometimes in a chocolate cup.', 'Ginjinha'],
        ['Poncha', 'Madeira\'s honey-lemon cane-spirit punch.', 'Poncha'],
        ['Vinho Verde', 'Light, slightly spritzy "green" wine.'],
        ['Galão', 'Lisbon\'s milky coffee in a glass.', 'Galão']
      ] },
      { name: 'Malta, Croatia, Montenegro & Turkey', where: 'Valletta · Dubrovnik · Split · Kotor · Kuşadası · Istanbul', items: [
        ['Kinnie', 'Malta\'s bittersweet orange soda; great zero-proof.'],
        ['Rakija', 'Balkan fruit brandy, offered as a welcome shot.'],
        ['Maraschino', 'Cherry liqueur from Zadar; try it in an Aviation.', 'Aviation'],
        ['Rakı', 'Turkey\'s anise spirit, the "lion\'s milk." Mix with water like ouzo.'],
        ['Turkish coffee', 'Thick, unfiltered and sipped slowly.']
      ] }
    ] },
    { region: 'South America & Antarctica', note: 'Equinox heads to South America in December: Argentina, Uruguay, Chile, Brazil, the Falklands and Antarctica.', places: [
      { name: 'Brazil', where: 'Rio de Janeiro · Búzios · Santos', items: [['Caipirinha', 'The national cocktail.', 'Caipirinha'], ['Batida de Coco', 'Creamy coconut and cachaça.', 'Batida de Coco']] },
      { name: 'Argentina', where: 'Buenos Aires · Ushuaia · Puerto Madryn', items: [['Fernet con Coca', 'The national obsession.', 'Fernet con Coca'], ['Malbec', 'Mendoza\'s famous red.'], ['Clericó', 'White-wine sangria.', 'Clericó']] },
      { name: 'Uruguay', where: 'Montevideo · Punta del Este', items: [['Medio y Medio', 'Half sparkling, half white wine from Café Roldós.', 'Medio y Medio'], ['Tannat', 'Uruguay\'s signature red grape.']] },
      { name: 'Chile & Peru', where: 'Valparaíso (San Antonio) · Punta Arenas · Lima (Callao)', items: [['Pisco Sour', 'Both countries claim it.', 'Pisco Sour'], ['Piscola', 'Chile\'s pisco and cola.', 'Piscola'], ['Terremoto', 'The "earthquake": wine and pineapple ice cream.', 'Terremoto'], ['Chilcano', 'Peru\'s pisco highball.', 'Chilcano']] }
    ] },
    { region: 'Caribbean, Bahamas & Bermuda', places: [
      { name: 'Puerto Rico', where: 'San Juan', items: [['Piña Colada', 'Born here in the 1950s.', 'Piña Colada'], ['Coquito', 'Holiday coconut eggnog.', 'Coquito']] },
      { name: 'Virgin Islands', where: 'St. Thomas · Tortola', items: [['Painkiller', 'Soggy Dollar Bar, Jost Van Dyke.', 'Painkiller'], ['Bushwacker', 'Born on St. Thomas in 1975.', 'Bushwacker']] },
      { name: 'Barbados, Jamaica & Grand Cayman', where: 'Bridgetown · Falmouth · Ocho Rios · George Town', items: [['Rum Punch (Bajan)', 'One of sour, two of sweet, three of strong, four of weak.', 'Rum Punch (Bajan)'], ['Dirty Banana', 'Jamaica\'s resort shake.', 'Dirty Banana'], ['Mudslide', 'Invented at Rum Point, Grand Cayman.', 'Mudslide']] },
      { name: 'ABC islands & St. Maarten', where: 'Aruba · Curaçao · Philipsburg', items: [['Aruba Ariba', 'Aruba\'s signature punch.', 'Aruba Ariba'], ['Blue curaçao drinks', 'Curaçao is the home of the orange liqueur.', 'Blue Hawaiian'], ['Guavaberry Colada', 'St. Maarten\'s guavaberry liqueur.', 'Guavaberry Colada']] },
      { name: 'French & Eastern Caribbean', where: 'Martinique · Guadeloupe · St. Kitts · Trinidad', items: [['Ti\' Punch', 'Rhum agricole, lime and cane syrup.', 'Ti\' Punch'], ['Ting with a Sting', 'St. Kitts\' rum and grapefruit soda.', 'Ting with a Sting'], ['Queen\'s Park Swizzle', 'Trinidad\'s minty swizzle.', 'Queen\'s Park Swizzle']] },
      { name: 'Bahamas & Bermuda', where: 'Nassau · Freeport · Royal Naval Dockyard', items: [['Goombay Smash', 'The Bahamas\' favorite.', 'Goombay Smash'], ['Sky Juice', 'Gin, coconut water and condensed milk.', 'Sky Juice'], ['Dark \'n\' Stormy', 'Bermuda\'s ginger beer and black rum.', 'Dark \'n\' Stormy'], ['Rum Swizzle', 'The Swizzle Inn\'s house drink.', 'Rum Swizzle']] }
    ] },
    { region: 'Mexico, Central America & Florida', places: [
      { name: 'Mexico', where: 'Cozumel · Costa Maya · Progreso · Puerto Vallarta · Cabo', items: [['Paloma', 'More popular than the margarita with locals.', 'Paloma'], ['Michelada', 'Spicy beer cocktail.', 'Michelada'], ['Cantarito', 'Citrus and tequila in a clay cup.', 'Cantarito'], ['Xtabentún', 'The Yucatán\'s anise-honey liqueur.', 'Xtabentún'], ['Mezcal', 'Sip it with orange and chili salt.', 'Mezcal Neat']] },
      { name: 'Central America', where: 'Roatán · Belize City · Puerto Limón · Colón', items: [['Monkey La La', 'Roatán\'s chocolate-coconut mudslide.', 'Monkey La La'], ['Guaro Sour', 'Costa Rica\'s everyday cocktail.', 'Guaro Sour'], ['Aguardiente', 'Colombia\'s anise spirit.', 'Aguardiente']] },
      { name: 'Florida', where: 'Key West · Miami · Fort Lauderdale', items: [['Key Lime Pie Martini', 'Key West in a glass.', 'Key Lime Pie Martini'], ['Rum Runner', 'Invented in Islamorada.', 'Rum Runner']] }
    ] }
  ];
  const GLOSSARY = [
    ['Up', 'Chilled and strained into a stemmed glass, no ice.'], ['On the rocks', 'Served over ice.'], ['Neat', 'Straight from the bottle, no ice.'],
    ['Dry', 'Less vermouth in a martini, or less sweet in general.'], ['Dirty', 'With olive brine.'], ['Twist', 'A strip of citrus peel.'],
    ['Float', 'A little spirit layered on top.'], ['Muddle', 'Gently crush fruit or herbs in the glass.'], ['Rim', 'Salt, sugar or Tajín around the edge.'],
    ['Splash · Dash', 'A little · a few drops.'], ['Call brand', 'Asking for a specific brand, like Patrón or Grey Goose.'], ['Well', 'The house pour.'],
    ['Back · Chaser', 'A small side drink sipped after.'], ['Virgin · Zero-proof', 'No alcohol.'], ['Skinny', 'Less sugar, often soda water instead of syrup.'],
    ['Frozen', 'Made in the blender with ice.'], ['Simple syrup', 'Sugar dissolved in water.'], ['Sour mix', 'Pre-made lemon-lime and sugar. Ask for fresh citrus instead.'],
    ['Cream of coconut', 'Sweetened coconut cream (Coco López). Not coconut milk.'], ['Orgeat', 'Almond syrup used in tiki drinks.'],
    ['Falernum', 'Lime-ginger-clove syrup or liqueur.'], ['Aperitivo · Digestivo', 'Before-dinner · after-dinner drinks.']
  ];
  const fact = (ok, html) => `<li class="${ok ? '' : 'no'}">${ok ? I.ok : I.no}<span>${html}</span></li>`;
  function linkTo(name, label) { const r = byName(name); return r ? `<button type="button" data-act="open" data-id="${r.id}">${esc(label || r.name)}</button>` : `<b>${esc(label || name)}</b>`; }
  function renderGuide(opt) {
    const open = opt && opt.sec;
    const sec = (id, title, inner) => `<details class="acc" id="g-${id}" ${open === id ? 'open' : ''}><summary>${esc(title)}${I.chev}</summary><div class="body">${inner}</div></details>`;
    $('#v-guide').innerHTML = `
      <div class="section-head"><h2 class="display" style="font-size:26px">Guide</h2></div>
      <div>
      ${sec('pkg', 'Your Premium package, decoded', `
        <div class="bigfig"><b>$19</b><span>Premium covers any single drink priced up to $19 (Classic stops at $12).</span></div>
        <ul class="facts-list">
          ${fact(true, 'Cocktails, frozen drinks, spirits, wine by the glass, craft beer, specialty coffee and tea, Coca-Cola sodas and premium bottled water.')}
          ${fact(true, 'Over $19? You pay only the difference, plus 20% gratuity on it.')}
          ${fact(true, 'No daily drink limit. Bartenders can still refuse service.')}
          ${fact(true, 'Works in bars and lounges, the main dining room, and specialty and casual restaurants.')}
          ${fact(true, '20% off wine by the bottle.')}
          ${fact(false, 'One drink at a time, for you only. It can\'t be shared or used to buy rounds.')}
          ${fact(false, 'Room service and the in-room minibar aren\'t included.')}
          ${fact(false, 'Drinks ashore aren\'t covered.')}
        </ul>
        <p class="muted" style="font-size:13px">Rules and caps as reported for 2026 sailings. If something rings up oddly, ask the bartender or Guest Services.</p>`)}
      ${sec('tips', 'Order like a regular', `
        <ul class="facts-list">
          ${fact(true, '<b>Name your brand.</b> With a $19 cap, call for Patrón, Grey Goose, Hendrick\'s and the like. For ultra-premium pours, ask "Is this covered?" first.')}
          ${fact(true, '<b>Ask for fresh lime and "less sweet."</b> Frozen drinks usually start from a mix; shaken drinks can be made fresh.')}
          ${fact(true, '<b>Use the Bartender Card</b> for anything unusual. Big text, ounces and milliliters.')}
          ${fact(true, '<b>Order two different drinks and swap sips.</b> The fastest way to find new favorites.')}
          ${fact(true, '<b>Learn your bartender\'s name.</b> Tell them your favorite once and they\'ll often remember it.')}
          ${fact(true, '<b>Coffee is covered.</b> Café al Bacio lattes and cappuccinos are part of Premium.')}
          ${fact(true, '<b>Grab bottled water</b> before you head ashore.')}
          ${fact(true, '<b>Customize:</b> a dark-rum float, a Tajín or toasted-coconut rim, or "make it frozen."')}
        </ul>`)}
      ${sec('bars', 'Celebrity Equinox bar guide', `
        <div class="bar-list">
          ${[
            ['Martini Bar & Crush', 'Ice-topped bar with flair bartenders. Look for evening martini-tower pours.', ['Espresso Martini', 'Lychee Martini', 'Key Lime Pie Martini']],
            ['Sunset Bar', 'Open-air at the back of the ship. Arrive 30 minutes before sunset on sail-away nights.', ['Aperol Spritz', 'Painkiller', 'Rum Runner']],
            ['Pool deck & Solarium', 'Frozen-drink central. The Solarium is adults-only and calmer.', ['Coconut Patrón Margarita', 'Piña Colada', 'Miami Vice']],
            ['Café al Bacio & Gelateria', 'Specialty coffee, covered by Premium, plus gelato.', ['Cappuccino', 'Affogato', 'Iced Latte']],
            ['Cellar Masters', 'The wine bar: by-the-glass pours, flights and tastings.', ['Kir Royale', 'Bellini']],
            ['Ensemble Lounge', 'Live jazz and classic cocktails.', ['French 75', 'Sidecar', 'Negroni']],
            ['Sky Observation Lounge', 'Big windows up top. Afternoon spritzes, evening nightcaps.', ['Hugo Spritz', 'Brandy Alexander']],
            ['Michael\'s Club', 'A quieter, clubby lounge for after dinner.', ['Carajillo', 'Amaro Digestivo', 'Cognac Neat']],
            ['Quasar & late night', 'Dance-floor energy.', ['Lemon Drop Shot', 'Tokyo Tea', 'Vodka Red Bull']],
            ['The Lawn Club', 'Real grass on the top deck.', ['Pimm\'s Cup', 'Hugo Spritz']]
          ].map(([n, d, ds]) => `<div class="bar-item"><b>${esc(n)}</b><p>${esc(d)}</p><div class="linkrow">${ds.map(x => linkTo(x)).join('')}</div></div>`).join('')}
        </div>
        <p class="muted" style="font-size:13px">Venues change after refits. Check the Celebrity app or the daily planner for what's open on your sailing.</p>`)}
      ${sec('ports', 'Port sips: local drinks ashore', PORTS.map(reg => `
        <p class="eyebrow" style="margin-top:6px">${esc(reg.region)}</p>${reg.note ? `<p class="muted" style="font-size:13px">${esc(reg.note)}</p>` : ''}
        ${reg.places.map(p => `<div class="port"><h4>${esc(p.name)}</h4><p class="where">${esc(p.where)}</p><ul>${p.items.map(([n, d, link]) => `<li>${link ? linkTo(link, n) : `<b>${esc(n)}</b>`}: ${esc(d)}</li>`).join('')}</ul></div>`).join('')}`).join('') + '<p class="muted" style="font-size:13px">Drinks ashore are not covered by your package. Keep an eye on all-aboard time.</p>')}
      ${sec('smart', 'Sip smart at sea', `
        <ul class="facts-list">
          ${fact(true, '<b>Alternate with water.</b> Sun, salt air and alcohol dehydrate fast. The tracker nudges you when you\'re two drinks ahead.')}
          ${fact(true, '<b>Watch the strength dots.</b> Some frozen drinks hold 3 oz of liquor and taste like a smoothie.')}
          ${fact(true, '<b>Caffeine hides how drunk you feel</b> (espresso martinis, Vodka Red Bull).')}
          ${fact(true, '<b>Seasickness meds and alcohol</b> make you extra drowsy. Meclizine, Dramamine and scopolamine patches all warn against mixing.')}
          ${fact(true, '<b>Eat first.</b> And set an alarm for all-aboard time on port days.')}
        </ul>
        <p class="muted" style="font-size:13px">"≈1.5 standard drinks" means about 1.5 × 0.6 oz of pure alcohol, using typical bottle strengths.</p>`)}
      ${sec('lingo', 'Bar lingo', `<dl class="gloss">${GLOSSARY.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`)}
      ${sec('offline', 'Keep it offline', offlineHTML())}
      ${sec('settings', 'Settings & backup', settingsHTML('g'))}
      </div>
      <p class="foot">Sip &amp; Sail · ${TOTAL} recipes · Unofficial guide, not affiliated with Celebrity Cruises. Drink responsibly.</p>`;
    bindSettings($('#v-guide'));
    if (open) { const d = $('#g-' + open); if (d) setTimeout(() => d.scrollIntoView({ block: 'start' }), 30); }
  }
  const SITE = window.SIPSAIL_URL || '';
  function offlineHTML() {
    const link = SITE ? `<b>${esc(SITE.replace(/^https:\/\//, ''))}</b>` : 'the Sip &amp; Sail web link';
    return `<p>Everything (all ${TOTAL} recipes, the quiz, the tracker and this guide) lives inside this one page. Nothing needs the internet once it's on your phone.</p>
      ${SITE ? `<div class="say"><p class="eyebrow">Web link</p><p style="word-break:break-all">${esc(SITE)}</p><div class="btn-row"><button class="btn small" type="button" data-act="copy-site">${I.copy}Copy link</button></div></div>` : ''}
      <ul class="facts-list">
        ${fact(true, `<b>iPhone:</b> open ${link} in Safari, tap Share, then <b>Add to Home Screen</b>. Open it once while online; after that it works in airplane mode.`)}
        ${fact(true, `<b>Android:</b> open ${link} in Chrome, tap ⋮, then <b>Install app</b> or <b>Add to Home screen</b>. Or open the downloaded .html file with Chrome.`)}
        ${fact(true, '<b>Have the .html file?</b> It runs offline in any browser on a laptop or Android. iPhone\'s Files app can\'t run it, so use the web link there.')}
        ${fact(true, '<b>Your data stays on this phone:</b> favorites, ratings, notes and the tracker. Use Backup below to move them to another phone.')}
      </ul>`;
  }
  function settingsHTML(px) {
    const ppl = S.people.concat(['', '', '', '']).slice(0, 4);
    return `<div class="settings-grid">
      <div class="field"><span>Units</span><div class="seg" role="group" aria-label="Units">${[['both', 'oz + ml'], ['oz', 'oz only'], ['ml', 'ml only']].map(([k, l]) => `<button type="button" data-act="set-units" data-k="${k}" aria-pressed="${S.units === k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>Theme</span><div class="seg" role="group" aria-label="Theme">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" data-act="set-theme" data-k="${k}" aria-pressed="${S.theme === k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>Who's drinking (for the tracker)</span><div class="price-grid">${ppl.map((p, i) => `<label class="field" for="${px}-person-${i}"><span class="muted" style="font-size:12px">Person ${i + 1}</span><input id="${px}-person-${i}" data-set="person" data-i="${i}" value="${esc(p)}" placeholder="${i < 2 ? (i ? 'Partner' : 'Me') : 'Optional'}" maxlength="18"></label>`).join('')}</div></div>
      <label class="field" for="${px}-pkg"><span>Your package price per person per day, including gratuity ($)</span><input id="${px}-pkg" data-set="pkg" inputmode="decimal" value="${esc(S.pkg)}" placeholder="e.g. 110"></label>
      <div class="field"><span>Estimated menu prices for the value tracker ($)</span><div class="price-grid">${Object.keys(DEFAULT_PRICES).map(k => `<label class="field" for="${px}-price-${k}"><span class="muted" style="font-size:12px">${PRICE_LABELS[k]}</span><input id="${px}-price-${k}" data-set="price" data-k="${k}" inputmode="decimal" value="${esc(S.prices[k])}"></label>`).join('')}</div></div>
      <div class="field"><span>Backup</span><p class="muted" style="font-size:13px">Copy a backup code and paste it into Restore on another phone or after clearing your browser.</p>
        <div class="btn-row"><button class="btn small" type="button" data-act="backup">${I.copy}Copy backup code</button></div>
        <label class="field" for="${px}-restore"><span class="muted" style="font-size:12px">Restore from backup code</span><textarea id="${px}-restore" class="restore-box" placeholder="Paste a backup code here"></textarea></label>
        <div class="btn-row"><button class="btn small" type="button" data-act="restore">Restore</button><button class="btn small" type="button" data-act="reset">Clear all my data</button></div>
      </div>
    </div>`;
  }
  function bindSettings(root) {
    $$('[data-set]', root).forEach(inp => {
      inp.addEventListener('change', () => {
        const t = inp.dataset.set;
        if (t === 'person') { const i = +inp.dataset.i; const arr = S.people.concat(['', '', '', '']).slice(0, 4); arr[i] = inp.value.trim(); while (arr.length > 1 && !arr[arr.length - 1]) arr.pop(); S.people = arr.length ? arr : ['Me']; }
        else if (t === 'pkg') S.pkg = inp.value.replace(/[^0-9.]/g, '');
        else if (t === 'price') { const v = parseFloat(inp.value); if (!isNaN(v)) S.prices[inp.dataset.k] = v; }
        saveS();
        toast('Settings saved');
      });
    });
  }
  function openSettingsSheet() {
    const el = openOverlay(`<div class="panel" role="dialog" aria-modal="true" aria-label="Settings"><div class="panel-bar"><span class="eyebrow">Settings</span><button class="icon-btn" type="button" data-act="close" aria-label="Close">${I.x}</button></div>${settingsHTML('s')}<h3>Offline</h3>${offlineHTML()}</div>`, { onClose: refresh });
    bindSettings(el);
  }

  // ---------- actions ----------
  let resetArmed = 0;
  const ACT = {
    open: t => { const top = stack[stack.length - 1]; openDrink(t.dataset.id, !!(top && (top.el.dataset.drink || top.el.dataset.spin))); },
    'open-from-spin': t => openDrink(t.dataset.id, true),
    close: () => closeTop(),
    fav: t => toggleFav(t.dataset.id, t),
    log: t => logDrink(t.dataset.id),
    rate: t => setRating(t.dataset.id, +t.dataset.n),
    bartender: t => openBartender(t.dataset.id),
    'bt-units': t => { S.units = t.dataset.k; saveS(); const top = stack[stack.length - 1]; if (top && top.el._draw) top.el._draw(); },
    units: () => { S.units = S.units === 'both' ? 'oz' : S.units === 'oz' ? 'ml' : 'both'; saveS(); const top = stack[stack.length - 1]; const id = top && top.el.dataset.drink; if (id) { const sc = top.el.scrollTop; openDrink(id, true); stack[stack.length - 1].el.scrollTop = sc; } },
    copy: t => { const r = byId.get(t.dataset.id); copyText(C.recipeText(r, ING, S.units), 'Recipe copied'); },
    surprise: () => openSurprise(surpriseMode),
    respin: t => openSurprise(t.dataset.k, true),
    smode: t => { surpriseMode = t.dataset.k; $$('[data-act="smode"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === surpriseMode)); },
    musttab: t => { mustTab = +t.dataset.i; renderHome(); },
    'browse-must': () => go('browse', { reset: true, quick: 'must' }),
    guide: t => go('guide', { sec: t.dataset.sec }),
    settings: () => openSettingsSheet(),
    'offline-help': () => go('guide', { sec: 'offline' }),
    filters: () => openFilters(),
    cat: t => { const k = t.dataset.k; if (!k) F.cats.clear(); else if (F.cats.has(k)) F.cats.delete(k); else F.cats.add(k); $$('[data-act="cat"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k ? F.cats.has(b.dataset.k) : !F.cats.size)); renderResults(); },
    quick: t => { const k = t.dataset.k; if (F.quick.has(k)) F.quick.delete(k); else F.quick.add(k); t.setAttribute('aria-pressed', F.quick.has(k)); renderResults(); },
    more: () => appendMore(),
    rm: t => { const set = F[t.dataset.t]; set.delete(t.dataset.t === 'str' ? +t.dataset.k : t.dataset.k); renderResults(); },
    'clear-filters': () => { F.cats.clear(); F.inc.clear(); F.exc.clear(); F.flav.clear(); F.str.clear(); F.quick.clear(); F.q = ''; renderBrowse(); },
    'clear-filters-sheet': () => { F.inc.clear(); F.exc.clear(); F.flav.clear(); F.str.clear(); const top = stack[stack.length - 1]; $$('.chip', top.el).forEach(c => { c.classList.remove('inc', 'exc'); if (c.hasAttribute('aria-pressed')) c.setAttribute('aria-pressed', 'false'); }); updateFilterSheet(); },
    str: t => { const k = +t.dataset.k; if (F.str.has(k)) F.str.delete(k); else F.str.add(k); t.setAttribute('aria-pressed', F.str.has(k)); updateFilterSheet(); },
    flav: t => { const k = t.dataset.k; if (F.flav.has(k)) F.flav.delete(k); else F.flav.add(k); t.setAttribute('aria-pressed', F.flav.has(k)); updateFilterSheet(); },
    ing: t => { const k = t.dataset.k; if (F.inc.has(k)) { F.inc.delete(k); F.exc.add(k); } else if (F.exc.has(k)) F.exc.delete(k); else F.inc.add(k); t.classList.toggle('inc', F.inc.has(k)); t.classList.toggle('exc', F.exc.has(k)); updateFilterSheet(); },
    anyall: t => { F.any = t.dataset.k === 'any'; $$('[data-act="anyall"]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.k === 'any') === F.any)); updateFilterSheet(); },
    answer: t => answer(t.dataset.q, t.dataset.k),
    'quiz-prev': () => { quiz.step = Math.max(0, quiz.step - 1); renderQuiz(); },
    'quiz-restart': () => { quiz.step = 0; quiz.ans = {}; quiz.result = null; renderQuiz(); },
    'quiz-back': () => { quiz.result = null; renderQuiz(); },
    'quiz-shuffle': () => { quiz.seed = Date.now(); quiz.result = scoreAll(); renderQuiz(); },
    bartab: t => { barTab = t.dataset.k; renderMyBar(); },
    person: t => { S.person = +t.dataset.i; saveS(); renderMyBar(); },
    day: t => { dayOffset = Math.min(0, dayOffset + +t.dataset.d); renderMyBar(); },
    goday: t => { dayOffset = Math.min(0, +t.dataset.d); renderMyBar(); try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } },
    quickadd: t => quickAdd(t.dataset.k),
    'pick-drink': () => openPicker(),
    pick: t => { closeTop(); logDrink(t.dataset.id); },
    unlog: t => { const e = log.find(x => x.id === t.dataset.id); log = log.filter(x => x.id !== t.dataset.id); saveLog(); renderMyBar(); if (e) toast(`Removed ${e.name}`, () => { log.push(e); saveLog(); renderMyBar(); }); },
    'copy-shop': () => copyText(shopText, 'List copied'),
    'copy-site': () => copyText(SITE, 'Link copied'),
    'set-units': t => { S.units = t.dataset.k; saveS(); $$('[data-act="set-units"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === S.units)); toast('Units updated'); },
    'set-theme': t => { S.theme = t.dataset.k; saveS(); applyTheme(); $$('[data-act="set-theme"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === S.theme)); },
    backup: () => copyText(JSON.stringify({ app: 'sipsail', v: 1, settings: S, favs: [...favs], tried, log, shop: [...shop] }), 'Backup code copied'),
    restore: t => {
      const box = t.closest('.settings-grid').querySelector('.restore-box'); if (!box) return;
      try {
        const d = JSON.parse(box.value);
        if (d.app !== 'sipsail') throw new Error('not ours');
        Object.assign(S, d.settings || {}); S.prices = Object.assign({}, DEFAULT_PRICES, S.prices || {});
        favs = new Set(d.favs || []); tried = d.tried || {}; log = d.log || []; shop = new Set(d.shop || []);
        saveS(); saveFavs(); saveTried(); saveLog(); saveShop(); applyTheme();
        toast('Backup restored'); box.value = '';
      } catch (e) { toast('That code didn\'t work. Copy the whole backup code and try again.'); }
    },
    reset: t => {
      if (Date.now() - resetArmed > 4000) { resetArmed = Date.now(); t.textContent = 'Tap again to clear everything'; return; }
      favs = new Set(); tried = {}; log = []; shop = new Set();
      saveFavs(); saveTried(); saveLog(); saveShop();
      t.textContent = 'Cleared'; toast('All your data was cleared');
    },
    shopcheck: t => { const k = t.dataset.k; if (t.checked) shop.add(k); else shop.delete(k); saveShop(); t.closest('.shop-item').classList.toggle('done', t.checked); }
  };

  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) {
      if (stack.length) while (stack.length) closeTop();
      go(g.dataset.go);
      return;
    }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const fn = ACT[t.dataset.act];
    if (!fn) return;
    if (t.dataset.act === 'shopcheck') { fn(t, e); return; }
    if (t.tagName === 'A') e.preventDefault();
    fn(t, e);
  });

  // ---------- status & offline ----------
  function setStatus(state) {
    const el = $('#status'); if (!el) return;
    const map = { file: ['ok', 'Offline file'], ready: ['ok', 'Offline ready'], saving: ['', 'Saving offline…'], online: ['', 'Keep offline'] };
    const [cls, label] = map[state] || map.online;
    el.className = 'status-pill ' + cls;
    el.querySelector('span').textContent = label;
  }
  function initOffline() {
    let framed = false;
    try { framed = window.top !== window.self; } catch (e) { framed = true; }
    if (location.protocol === 'file:') { setStatus('file'); return; }
    if (!framed && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && document.querySelector('link[rel="manifest"]')) {
      setStatus(navigator.serviceWorker.controller ? 'ready' : 'saving');
      navigator.serviceWorker.register('sw.js').then(reg => {
        const done = () => setStatus('ready');
        if (reg.active) done();
        navigator.serviceWorker.ready.then(done);
      }).catch(() => setStatus('online'));
      return;
    }
    setStatus('online');
  }

  // ---------- boot ----------
  const setHead = () => { const h = $('.top'); if (h) document.documentElement.style.setProperty('--head-h', h.offsetHeight + 'px'); };
  window.addEventListener('resize', setHead);
  applyTheme();
  buildDefs();
  $('#brand-sub').textContent = `${TOTAL} recipes · no whiskey`;
  if (DATA.errors.length && window.console) console.warn('Sip & Sail data issues:', DATA.errors);
  go(view);
  setHead();
  initOffline();
})();
