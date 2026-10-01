/* Sip & Sail core: parses the compact drink data and derives facts
   (strength, color, flavor tags, method steps). Runs in the browser and in Node. */
(function (root) {
  'use strict';

  const GROUPS = {
    spirit: 'Spirits', liqueur: 'Liqueurs & aperitifs', wine: 'Wine, bubbly & fortified',
    beer: 'Beer & cider', juice: 'Juices & purées', mixer: 'Sodas & mixers',
    syrup: 'Syrups & sweeteners', dairy: 'Cream, milk & ice cream', fresh: 'Fresh fruit & herbs',
    coffee: 'Coffee, tea & cocoa', accent: 'Bitters, rims & spices'
  };
  const CATS = {
    tiki: 'Tropical & Tiki', marg: 'Margaritas & Agave', martini: 'Martinis',
    classic: 'Classics & Sours', highball: 'Highballs & Mules', bubbly: 'Spritzes & Bubbly',
    wine: 'Wine & Sangria', beer: 'Beer Cocktails', dessert: 'Dessert & Creamy',
    coffee: 'Coffee & Warm', shot: 'Shots & Sippers', zero: 'Zero-Proof'
  };
  const GLASSES = {
    coupe: 'coupe', martini: 'martini glass', rocks: 'rocks glass', dbl: 'double rocks glass',
    highball: 'highball glass', collins: 'Collins glass', hurricane: 'hurricane glass',
    tiki: 'tiki mug', flute: 'Champagne flute', wine: 'wine glass', copper: 'copper mug',
    marg: 'margarita glass', shot: 'shot glass', pint: 'pint glass', mug: 'glass mug',
    cup: 'coffee cup', snifter: 'snifter', coconut: 'coconut shell (or hurricane glass)',
    goblet: 'balloon (copa) glass', bowl: 'punch bowl'
  };
  const UP_GLASSES = new Set(['coupe', 'martini', 'flute', 'nick']);
  const METHODS = {
    sh: 'Shaken, served up', shr: 'Shaken, on the rocks', shd: 'Shaken, poured with the ice',
    st: 'Stirred, served up', str: 'Stirred, on the rocks', bu: 'Built over ice', bn: 'Built, no ice',
    bl: 'Blended', mu: 'Muddled', mus: 'Muddled & shaken', ly: 'Layered', hot: 'Served hot',
    sw: 'Swizzled', sht: 'Shaken shot', po: 'Poured'
  };
  const MUDDLE = new Set(['mint', 'basil', 'rosemary', 'cucumber', 'jalapeno', 'limewedge', 'lemonwedge',
    'orangeslice', 'cherry', 'straw', 'raspberries', 'blackberries', 'blueberries', 'pinechunk', 'melon',
    'ginger', 'sugar']);
  // How strongly a creamy ingredient whitens (scatters) a drink, for the color model.
  const CREAMY = { cream: 1, milk: .9, icecream: .85, cococream: .85, 'coconut-milk': .8, condensed: .8,
    baileys: .65, rumchata: .7, godiva: .35, trose: .55, eggwhite: .35, sorbet: .6, banana: .5, whipped: 0 };
  const DEFAULT_TOP = { wine: 3, beer: 8, mixer: 3.5, coffee: 4, juice: 3 };
  const STD_OZ = 0.6; // US standard drink = 0.6 fl oz of pure alcohol
  const STRENGTH = ['Zero-proof', 'Light', 'Medium', 'Strong', 'Very strong'];

  const FLAVOR_LABELS = {
    sweet: 'Sweet', tart: 'Tart', fruity: 'Fruity', tropical: 'Tropical', creamy: 'Creamy',
    coconut: 'Coconut', bitter: 'Bitter', fresh: 'Refreshing', herbal: 'Herbal', minty: 'Minty',
    citrus: 'Citrusy', spicy: 'Spicy', ginger: 'Ginger', bubbly: 'Bubbly', coffee: 'Coffee',
    choc: 'Chocolate', nutty: 'Nutty', berry: 'Berry', floral: 'Floral', smoky: 'Smoky',
    savory: 'Savory', dry: 'Dry', dessert: 'Dessert', anise: 'Anise', brunch: 'Brunch',
    elegant: 'Elegant', fun: 'Party', strong: 'Boozy', frozen: 'Frozen', hot: 'Warm'
  };

  const AMT = [
    [/^(\d*\.?\d+)$/, m => ({ t: 'oz', n: +m[1] })],
    [/^d(\d+)$/, m => ({ t: 'dash', n: +m[1] })],
    [/^sp$/, () => ({ t: 'splash' })],
    [/^top(\d*\.?\d*)$/, m => ({ t: 'top', n: m[1] ? +m[1] : 0 })],
    [/^b(\d*\.?\d+)$/, m => ({ t: 'bsp', n: +m[1] })],
    [/^t(\d*\.?\d+)$/, m => ({ t: 'tsp', n: +m[1] })],
    [/^x(\d+)$/, m => ({ t: 'count', n: +m[1] })],
    [/^sc(\d+)$/, m => ({ t: 'scoop', n: +m[1] })],
    [/^rim$/, () => ({ t: 'rim' })],
    [/^f(\d*\.?\d+)$/, m => ({ t: 'float', n: +m[1] })],
    [/^rinse$/, () => ({ t: 'rinse' })],
    [/^pinch$/, () => ({ t: 'pinch' })]
  ];

  function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '');
  }

  function parseIngredients(text) {
    const ING = {};
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line[0] === '#') continue;
      const [key, name, group, fam, abv, color, pig, uv, flags] = line.split('|');
      const [sing, plur] = name.split('/');
      ING[key] = {
        key, name: sing, plural: plur || sing, group, fam, abv: +abv || 0, color: '#' + color,
        pig: +pig || 0, uv: +uv || 0, flags: new Set((flags || '').split(/\s+/).filter(Boolean))
      };
    }
    return ING;
  }

  function parseAmount(tok) {
    for (const [re, f] of AMT) { const m = tok.match(re); if (m) return f(m); }
    return null;
  }

  function parseItem(tok, ING, errors, where) {
    let s = tok.trim(), opt = false;
    if (s[0] === '?') { opt = true; s = s.slice(1); }
    const sp = s.indexOf(' ');
    const amtTok = sp < 0 ? s : s.slice(0, sp);
    let rest = sp < 0 ? '' : s.slice(sp + 1).trim();
    let mod = '';
    const c = rest.indexOf(':');
    if (c >= 0) { mod = rest.slice(c + 1).trim(); rest = rest.slice(0, c).trim(); }
    const a = parseAmount(amtTok);
    if (!a) errors.push(`${where}: bad amount "${amtTok}"`);
    if (!ING[rest]) errors.push(`${where}: unknown ingredient "${rest}"`);
    return { key: rest, a: a || { t: 'oz', n: 0 }, mod, opt };
  }

  function itemVol(it, ing) {
    const a = it.a;
    switch (a.t) {
      case 'oz': case 'float': return a.n;
      case 'dash': return a.n * 0.03;
      case 'splash': return 0.25;
      case 'top': return a.n || DEFAULT_TOP[ing.group] || 0;
      case 'bsp': case 'tsp': return a.n * 0.17;
      case 'count': return a.n * ing.uv;
      case 'scoop': return a.n * 2;
      case 'rinse': return 0.05;
      default: return 0;
    }
  }

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) {
    return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  // Weighted subtractive mixing: the pigment mix sets the hue, pigment coverage sets how
  // deep it looks, creamy ingredients whiten it, and clear volume tints toward glass.
  function mixColor(items, ING) {
    let V = 0, S = 0, cream = 0;
    const A = [0, 0, 0];
    for (const it of items) {
      if (it.opt || it.a.t === 'rim' || it.a.t === 'rinse') continue;
      const ing = ING[it.key];
      const v = itemVol(it, ing);
      if (!v) continue;
      V += v;
      if (ing.pig > 0) {
        const c = hexToRgb(ing.color), w = v * ing.pig;
        S += w;
        for (let k = 0; k < 3; k++) A[k] += w * -Math.log(Math.max(c[k] / 255, 0.03));
      }
      if (CREAMY[it.key]) cream += v * CREAMY[it.key];
    }
    if (!V) return '#e6eef1';
    const D = S ? Math.min(1, S / (V * 0.55)) : 0;
    const depth = Math.pow(D, 0.75);
    let rgb = S ? A.map(a => 255 * Math.exp(-(a / S) * depth)) : [255, 255, 255];
    const w = Math.min(0.72, (cream / V) * 1.45);
    if (w > 0) {
      const white = [247, 240, 228];
      rgb = rgb.map((v, k) => v * (1 - w) + white[k] * w);
    }
    const t = (1 - D) * 0.55, tint = [226, 238, 242];
    rgb = rgb.map((v, k) => v * (1 - t) + tint[k] * t);
    return rgbToHex(rgb);
  }

  function parseData(ingText, recipeText, listText) {
    const ING = parseIngredients(ingText);
    const errors = [];
    const recipes = [];
    const byName = new Map();
    let cat = null;
    recipeText.split('\n').forEach((raw, ln) => {
      const line = raw.trim();
      if (!line || line[0] === '#') return;
      if (line.startsWith('@cat ')) { cat = line.slice(5).trim(); if (!CATS[cat]) errors.push(`bad cat ${cat}`); return; }
      const parts = line.split('|');
      if (parts.length !== 7) { errors.push(`line ${ln + 1}: expected 7 fields, got ${parts.length}: ${line.slice(0, 60)}`); return; }
      const [name, tagStr, glass, method, ingStr, garnish, note] = parts;
      const where = name;
      if (!GLASSES[glass]) errors.push(`${where}: unknown glass ${glass}`);
      if (!METHODS[method]) errors.push(`${where}: unknown method ${method}`);
      const items = ingStr.split(';').filter(Boolean).map(t => parseItem(t, ING, errors, where));
      const tags = new Set(tagStr.split(',').map(s => s.trim()).filter(Boolean));
      let color = null;
      for (const t of [...tags]) if (t[0] === '#') { color = t; tags.delete(t); }
      const r = { name, cat, tags, glass, method, items, garnish: garnish === 'No garnish' ? '' : garnish, note, color };
      if (byName.has(norm(name))) errors.push(`duplicate drink name: ${name}`);
      byName.set(norm(name), r);
      recipes.push(r);
    });

    const ids = new Set();
    for (const r of recipes) {
      let id = slug(r.name), n = 2;
      while (ids.has(id)) id = slug(r.name) + '-' + n++;
      ids.add(id);
      r.id = id;
      derive(r, ING);
    }

    // Lists: @must <section> then "Name|why"; @coco then names
    const must = [], coco = [];
    let mode = null, section = null;
    (listText || '').split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line || line[0] === '#') return;
      if (line.startsWith('@must')) { mode = 'must'; section = { title: line.slice(5).trim(), items: [] }; must.push(section); return; }
      if (line.startsWith('@coco')) { mode = 'coco'; return; }
      if (mode === 'must') {
        const [name, why] = line.split('|');
        const r = byName.get(norm(name));
        if (!r) { errors.push(`must-try: unknown drink ${name}`); return; }
        r.must = true; r.mustWhy = why; r.mustSection = section.title;
        section.items.push(r);
      } else if (mode === 'coco') {
        const r = byName.get(norm(line));
        if (!r) { errors.push(`coco: unknown drink ${line}`); return; }
        coco.push(r);
      }
    });
    return { ING, recipes, byName, must, coco, errors };
  }

  function derive(r, ING) {
    let alc = 0, vol = 0;
    const fams = new Set(), keys = new Set();
    const ctags = new Set();
    const spiritAlc = {}, anyAlc = {};
    let citrusVol = 0;
    for (const it of r.items) {
      const ing = ING[it.key];
      if (!ing) continue;
      if (!it.opt) { keys.add(it.key); fams.add(ing.fam); }
      if (it.opt) continue;
      const v = itemVol(it, ing);
      vol += v;
      const a = v * ing.abv / 100;
      alc += a;
      if (a > 0) {
        anyAlc[ing.fam] = (anyAlc[ing.fam] || 0) + a;
        if (ing.group === 'spirit') spiritAlc[ing.fam] = (spiritAlc[ing.fam] || 0) + a;
      }
      const f = ing.flags;
      const big = v >= 0.25 || it.a.t === 'count' || it.a.t === 'top' || it.a.t === 'scoop' || it.a.t === 'rim';
      if (f.has('coconut')) ctags.add('coconut');
      if ((f.has('creamy') || f.has('dairy')) && v >= 0.75 && it.key !== 'whipped') ctags.add('creamy');
      if (f.has('nut') && v >= 0.25) ctags.add('nutty');
      if (f.has('choc') && v >= 0.25) ctags.add('choc');
      if (f.has('coffee') && v >= 0.25) ctags.add('coffee');
      if (f.has('minty') && (v >= 0.25 || (it.a.t === 'count' && it.a.n >= 4))) ctags.add('minty');
      if (f.has('bubbly') && big) ctags.add('bubbly');
      if (f.has('smoky')) ctags.add('smoky');
      if (f.has('spicy') && (big || it.a.t === 'dash' || it.a.t === 'pinch')) ctags.add('spicy');
      if (f.has('ginger') && big) ctags.add('ginger');
      if (f.has('herbal') && (v >= 0.25 || (it.a.t === 'count' && it.a.n >= 4))) ctags.add('herbal');
      if (f.has('floral') && (v >= 0.25 || it.a.t === 'dash')) ctags.add('floral');
      if (f.has('berry') && big) ctags.add('berry');
      if (f.has('anise') && v >= 0.25) ctags.add('anise');
      if (f.has('bitter') && v >= 0.5) ctags.add('bitter');
      if (f.has('tropical') && v >= 0.5) ctags.add('tropical');
      if (f.has('citrus') && it.a.t !== 'rim') citrusVol += v;
    }
    if (citrusVol >= 0.5) ctags.add('citrus');
    if (r.method === 'bl') ctags.add('frozen');
    if (r.method === 'hot') ctags.add('hot');
    r.std = alc / STD_OZ;
    r.vol = vol;
    r.zero = r.std < 0.15;
    r.strength = r.zero ? 0 : r.std < 0.9 ? 1 : r.std < 1.5 ? 2 : r.std < 2.2 ? 3 : 4;
    if (r.strength >= 3) ctags.add('strong');
    for (const t of ctags) r.tags.add(t);
    if (r.zero) r.tags.delete('strong');
    r.frozen = r.method === 'bl';
    r.fams = fams;
    r.keys = keys;
    const pick = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
    const sp = pick(spiritAlc), an = pick(anyAlc);
    r.base = sp ? sp[0] : an ? an[0] : 'Zero-proof';
    r.color = r.color || mixColor(r.items, ING);
    const names = r.items.filter(i => !i.opt && ING[i.key] && i.a.t !== 'rim').map(i => ING[i.key].name + ' ' + ING[i.key].fam + ' ' + i.mod);
    r.search = norm([r.name, r.base, CATS[r.cat], names.join(' '), [...r.tags].map(t => FLAVOR_LABELS[t] || t).join(' '), r.garnish].join(' '));
  }

  // ---------- formatting ----------
  const FR = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' };
  function frac(n) {
    const w = Math.floor(n + 1e-9);
    const f = Math.round((n - w) * 100) / 100;
    if (!f) return String(w);
    if (FR[f]) return (w || '') + FR[f];
    return String(Math.round(n * 100) / 100);
  }
  function ml(n) {
    const v = n * 30;
    return (Math.round(v * 2) / 2).toString().replace(/\.0$/, '');
  }
  function plural(n, s, p) { return n === 1 ? s : p; }
  function lc(s) { return s ? s[0].toLowerCase() + s.slice(1) : s; }

  // Returns {amt, ml, name} for display. units: 'both' | 'oz' | 'ml'
  function fmtItem(it, ING, units) {
    const ing = ING[it.key];
    const a = it.a;
    let name = ing.name;
    let mod = it.mod;
    if (mod && mod[0] === '=') { name = mod.slice(1); mod = ''; }
    else if (mod && !/^or |^as /.test(mod)) name = name.replace(/ \(.*\)$/, '');
    let amt = '', mlTxt = '';
    const oz = n => {
      if (units === 'ml') return { amt: ml(n) + ' ml', ml: '' };
      if (units === 'oz') return { amt: frac(n) + ' oz', ml: '' };
      return { amt: frac(n) + ' oz', ml: ml(n) + ' ml' };
    };
    switch (a.t) {
      case 'oz': ({ amt, ml: mlTxt } = oz(a.n)); break;
      case 'float': { const o = oz(a.n); amt = 'Float ' + o.amt; mlTxt = o.ml; break; }
      case 'dash': amt = a.n + ' ' + plural(a.n, 'dash', 'dashes'); break;
      case 'splash': amt = 'Splash'; break;
      case 'top': if (a.n) { const o = oz(a.n); amt = 'Top · ' + o.amt; mlTxt = o.ml; } else amt = 'Top with'; break;
      case 'bsp': amt = frac(a.n) + ' ' + plural(a.n, 'barspoon', 'barspoons'); break;
      case 'tsp': amt = frac(a.n) + ' tsp'; break;
      case 'count':
        amt = String(a.n);
        name = (it.mod && it.mod[0] === '=') ? name : (a.n === 1 ? ing.name : ing.plural);
        break;
      case 'scoop': amt = a.n + ' ' + plural(a.n, 'scoop', 'scoops'); break;
      case 'rim': amt = 'Rim'; break;
      case 'rinse': amt = 'Rinse'; break;
      case 'pinch': amt = 'Pinch'; break;
    }
    return { amt, ml: mlTxt, name, mod, opt: it.opt };
  }

  function itemPlain(it, ING, units) {
    const f = fmtItem(it, ING, units);
    return `${f.amt} ${f.name}${f.mod ? ' (' + f.mod + ')' : ''}${f.ml ? ' [' + f.ml + ']' : ''}${f.opt ? ' (optional)' : ''}`;
  }

  function shortName(it, ING) {
    const ing = ING[it.key];
    if (it.mod && it.mod[0] === '=') return lc(it.mod.slice(1));
    if (it.a.t === 'count') return lc(ing.plural);
    return lc(ing.name.replace(/ \(.*\)$/, ''));
  }
  function list(arr) {
    if (arr.length < 2) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  function steps(r, ING, units) {
    const out = [];
    const g = GLASSES[r.glass] || 'glass';
    const by = t => r.items.filter(i => i.a.t === t);
    const rims = by('rim'), rinses = by('rinse'), tops = by('top'), floats = by('float');
    const muddled = r.items.filter(i => MUDDLE.has(i.key) && (i.a.t === 'count' || i.key === 'sugar'));
    const up = UP_GLASSES.has(r.glass);
    if (rims.length) out.push(`Rim the ${g} with ${list(rims.map(i => shortName(i, ING)))}${rims.every(i => i.opt) ? ' (optional)' : ''}.`);
    if (rinses.length) out.push(`Rinse the chilled ${g} with a little ${list(rinses.map(i => shortName(i, ING)))}, then discard the excess.`);
    const mud = list(muddled.map(i => shortName(i, ING))) || 'fruit';
    switch (r.method) {
      case 'sh': out.push(`Shake hard with ice for 10–12 seconds, then strain into a chilled ${g}.`); break;
      case 'shr': out.push(`Shake hard with ice, then strain over fresh ice in a ${g}.`); break;
      case 'shd': out.push(`Shake with crushed ice and pour everything, ice and all, into a ${g}.`); break;
      case 'st': out.push(`Stir with ice until very cold (about 20 seconds), then strain into a chilled ${g}.`); break;
      case 'str': out.push(`Stir with ice, then strain over a large ice cube in a ${g}.`); break;
      case 'bu': out.push(`Fill a ${g} with ice, add the ingredients in order and stir gently.`); break;
      case 'bn': out.push(`Add the ingredients to a ${g} in order, without ice, and stir gently.`); break;
      case 'bl': out.push(`Blend with about a cup of ice until smooth, then pour into a ${g}.`); break;
      case 'mu': out.push(`Gently muddle the ${mud} in a ${g}. Fill with ice (crushed if possible), add the rest and stir.`); break;
      case 'mus': out.push(`Muddle the ${mud} in a shaker. Add the rest with ice, shake hard and ${up ? `double-strain into a chilled ${g}` : `strain over fresh ice in a ${g}`}.`); break;
      case 'ly': out.push(`Layer in the order listed: pour each one slowly over the back of a spoon into a ${g}.`); break;
      case 'hot': out.push(`Build in a warmed ${g} and stir to combine.`); break;
      case 'sw': out.push(`Build over crushed ice in a ${g}, then swizzle (or stir hard) until the glass frosts.`); break;
      case 'sht': out.push(`Shake with ice and strain into a ${g}.`); break;
      case 'po': out.push(`Pour into a ${g}.`); break;
    }
    if (tops.length) out.push(`Top with ${list(tops.map(i => shortName(i, ING)))}.`);
    if (floats.length) out.push(`Float ${list(floats.map(i => fmtItem(i, ING, units).amt.replace('Float ', '') + ' ' + shortName(i, ING)))} on top.`);
    return out;
  }

  const ORDER_METHOD = {
    sh: 'shaken and served up', shr: 'shaken and served over ice', shd: 'shaken and poured over crushed ice',
    st: 'stirred and served up', str: 'stirred and served over ice', bu: 'built over ice', bn: 'served without ice',
    bl: 'blended with ice', mu: 'muddled and served over crushed ice', mus: 'muddled and shaken', ly: 'layered',
    hot: 'served hot', sw: 'swizzled over crushed ice', sht: 'as a shot', po: 'poured neat'
  };
  const RIM_WORDS = { salt: 'salt', sugar: 'sugar', tajin: 'Tajín', toastedcoco: 'toasted-coconut',
    celerysalt: 'celery-salt', graham: 'graham-cracker', cinnsugar: 'cinnamon-sugar', sprinkles: 'sprinkle' };
  const GROUP_ORDER = ['spirit', 'liqueur', 'wine', 'beer', 'juice', 'syrup', 'dairy', 'coffee', 'fresh', 'mixer', 'accent'];
  function orderLine(r, ING) {
    const main = r.items.filter(i => !i.opt && !['rim', 'dash', 'rinse', 'pinch'].includes(i.a.t) && ING[i.key].group !== 'accent')
      .sort((a, b) => GROUP_ORDER.indexOf(ING[a.key].group) - GROUP_ORDER.indexOf(ING[b.key].group));
    const names = main.map(i => {
      const g = ING[i.key].group;
      if (i.mod && i.mod[0] !== '=' && !/^or |^as |e\.g\.| if |freshly|chilled|ice-cold|steamed|cold|hot/.test(i.mod) && (g === 'spirit' || g === 'liqueur')) return i.mod;
      return shortName(i, ING).replace(/^fresh (lime|lemon) juice$/, 'fresh $1');
    });
    const rims = r.items.filter(i => i.a.t === 'rim' && !i.opt).map(i => RIM_WORDS[i.key] || shortName(i, ING));
    let s = `Could I get a ${r.name}? It's ${list(names)}, ${ORDER_METHOD[r.method]}`;
    if (rims.length) s += `, with a ${list(rims)} rim`;
    return s + '.';
  }

  function recipeText(r, ING, units) {
    const lines = [r.name.toUpperCase(), ''];
    for (const it of r.items) lines.push('• ' + itemPlain(it, ING, units));
    lines.push('');
    steps(r, ING, units).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    if (r.garnish) lines.push(`Garnish: ${r.garnish}`);
    return lines.join('\n');
  }

  // Similarity for "you might also like"
  function similar(r, all, n) {
    const out = [];
    for (const o of all) {
      if (o === r) continue;
      let inter = 0;
      for (const f of r.fams) if (o.fams.has(f)) inter++;
      const uni = r.fams.size + o.fams.size - inter;
      let tInter = 0;
      for (const t of r.tags) if (o.tags.has(t)) tInter++;
      const tUni = r.tags.size + o.tags.size - tInter;
      let s = 2.2 * (uni ? inter / uni : 0) + 1.2 * (tUni ? tInter / tUni : 0);
      if (o.base === r.base) s += 0.35;
      if (o.cat === r.cat) s += 0.2;
      if (o.zero !== r.zero) s -= 1;
      out.push([s, o]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out.slice(0, n).map(x => x[1]);
  }

  const api = {
    GROUPS, CATS, GLASSES, METHODS, STRENGTH, FLAVOR_LABELS,
    parseData, fmtItem, itemPlain, steps, orderLine, recipeText, similar, norm, slug, frac, ml, mixColor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SSCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
