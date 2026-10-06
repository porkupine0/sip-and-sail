// Create with Claude, end to end in the web build (serve dist/web on localhost:8080 first).
// The Anthropic API is stubbed: each scenario queues the answer Claude would give.
const { chromium } = require('playwright');
const path = require('path');
const OUT = p => path.join(__dirname, 'shots', p);
const MSG = obj => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(obj) }],
  stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
const ing = (qty, unit, ingredient, extra) => Object.assign({ qty, unit, ingredient, newName: '', detail: '', optional: false }, extra || {});
const drink = o => Object.assign({ garnish: '', note: '', flavors: [], wellKnown: false, glass: 'coupe', method: 'sh', category: 'martini' }, o);
const KIWI_COLADA = { verdict: 'new', existing: '', reply: 'Here’s a frozen kiwi colada with a dragon-fruit swirl.', newIngredients: [
  { name: 'Dragon fruit purée', plural: 'Dragon fruit purée', group: 'juice', abv: 0, color: 'e0218a', tint: 'deep', flavors: ['tropical'], ozPerPiece: 0 }],
  drink: drink({ name: 'Kiwi Colada', category: 'tiki', glass: 'hurricane', method: 'bl', garnish: 'Kiwi wheel', note: 'A piña colada gone green, with a dragon-fruit swirl.',
    flavors: ['tropical', 'fruity', 'creamy'], ingredients: [ing(2, 'oz', 'wrum'), ing(1, 'count', 'kiwi'), ing(2, 'oz', 'cococream'), ing(2, 'oz', 'pine'), ing(1, 'oz', 'new', { newName: 'Dragon fruit purée' })] }) };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: process.argv[2] === 'dark' ? 'dark' : 'light' });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('nokey')) localStorage.setItem('sipsail.apikey', JSON.stringify('test-key')); });
  const calls = [];
  let answer = () => ({ json: MSG({ ok: true }) });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-expose-headers': '*' };
  await ctx.route('https://api.anthropic.com/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ url: req.url(), body });
    const a = answer(body);
    if (a.delay) await new Promise(r => setTimeout(r, a.delay));
    return route.fulfill({ status: a.status || 200, headers: { ...cors, 'content-type': 'application/json', 'request-id': 'req_test' }, body: JSON.stringify(a.json) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const out = {};
  const top = '#layer > :last-child';
  const tab = v => page.evaluate(v => document.querySelector(`.tabs [data-go="${v}"]`).click(), v);
  const settle = () => page.waitForFunction(() => { const o = document.querySelector('#mk-out'); return o && !o.querySelector('.pulse'); }, null, { timeout: 10000 }).then(() => page.waitForTimeout(350));
  const shot = async (name, full) => { await page.waitForTimeout(300); await page.screenshot({ path: OUT(name), fullPage: !!full }); };
  const closeAll = () => page.evaluate(() => { while (document.querySelector('#layer > :last-child')) document.querySelector('#layer > :last-child [data-act="close"]').click(); });
  const search = async q => { await tab('browse'); await page.fill('#q', q); await page.waitForTimeout(250); };

  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(500);
  out.brandBefore = await page.textContent('#brand-sub');

  // 1. a drink that isn't here: search finds nothing, Claude creates it, it's added and opens
  await search('kiwi colada');
  out.emptyCta = await page.textContent('#results .make-cta');
  await shot('40-empty-cta.png');
  answer = () => ({ json: MSG(KIWI_COLADA), delay: 1200 });
  await page.click('#results .make-cta [data-act="mk-open"]');
  await page.waitForTimeout(400);
  out.busyText = await page.textContent('#mk-out');
  await shot('41-busy.png');
  await settle();
  const req = calls[calls.length - 1].body;
  out.request = { model: req.model, effort: req.output_config.effort, cache: req.system[0].cache_control, betas: calls[calls.length - 1].url.includes('beta=true'),
    sysChars: req.system[0].text.length, hasAlias: req.system[0].text.includes('Passion Fruit Martini (aka Pornstar Martini)'), noWhiskeyRule: /no whiskey of any kind/i.test(req.system[0].text),
    enumHasKiwi: req.output_config.format.schema.properties.newIngredients && JSON.stringify(req.output_config.format.schema).includes('"kiwi"'),
    user: req.messages[0].content };
  out.newResult = await page.textContent(`${top} .mk-card h2`);
  out.newIngs = await page.$$eval(`${top} .mk-card .ing li`, ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
  await shot('42-new-result.png');
  await page.evaluate(sel => { document.querySelector(sel + ' .panel').scrollTop = 9999; }, top);
  await shot('43-new-result-bottom.png');
  await page.click(`${top} [data-act="mk-add"]`);
  await page.waitForTimeout(300);
  out.afterAdd = { detail: await page.textContent(`${top} #dt-name`), note: await page.textContent(`${top} .mine-note`), brand: await page.textContent('#brand-sub') };
  await shot('44-added-detail.png');
  await closeAll();
  await page.waitForTimeout(200);
  out.searchAfterAdd = await page.$$eval('#results .row-name', rs => rs.map(r => r.textContent));
  await page.fill('#q', ''); await page.waitForTimeout(250);
  await page.click('[data-act="quick"][data-k="mine"]');
  await page.waitForTimeout(200);
  out.mineFilter = await page.$$eval('#results .row-name', rs => rs.map(r => r.textContent));
  await page.click('[data-act="quick"][data-k="mine"]');

  // 2. it survives a reload, with its new ingredient
  await page.reload(); await page.waitForTimeout(500);
  await search('kiwi colada');
  await page.click('#results .row');
  await page.waitForTimeout(300);
  out.afterReload = await page.$$eval(`${top} .ing li`, ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
  await page.click(`${top} [data-act="fav"]`);
  await page.click(`${top} [data-act="log"]`);
  await closeAll();

  // 3. a drink that's already here under another name
  await search('pornstar');
  answer = () => ({ json: MSG({ verdict: 'exists', existing: 'Passion Fruit Martini', reply: 'You already have it: the Pornstar Martini is here as the Passion Fruit Martini.', drink: null, newIngredients: [] }) });
  await page.click('#results .make-cta [data-act="mk-open"]');
  await settle();
  out.exists = await page.textContent(`${top} .match h2`);
  await shot('45-exists.png');
  await page.click(`${top} .match [data-act="open"]`);
  await page.waitForTimeout(250);
  out.existsOpened = await page.textContent(`${top} #dt-name`);
  await page.click(`${top} [data-act="close"]`);
  await page.waitForTimeout(150);
  out.backToSheet = await page.evaluate(() => !!document.querySelector('#layer > :last-child').dataset.make);

  // 4. a twist on it
  answer = () => ({ json: MSG({ verdict: 'new', existing: '', reply: 'A tall, bubbly spin on it.', newIngredients: [], drink: drink({ name: 'Passion Fruit Spritz', category: 'bubbly', glass: 'wine', method: 'bu',
    flavors: ['bubbly', 'tropical'], ingredients: [ing(1.5, 'oz', 'passoa'), ing(1, 'oz', 'passion'), ing(3, 'oz', 'prosecco'), ing(0, 'top', 'soda')] }) }) });
  await page.click(`${top} [data-act="mk-twist"]`);
  await settle();
  out.twist = { user: calls[calls.length - 1].body.messages[0].content, result: await page.textContent(`${top} .mk-card h2`), text: await page.inputValue('#mk-text') };
  await closeAll();

  // 5. a better version of a drink from its page; and a "new" answer named like a drink that's here
  await search('mai tai');
  await page.click('#results .row');
  await page.waitForTimeout(250);
  answer = () => ({ json: MSG({ verdict: 'better', existing: 'Mai Tai (Trader Vic\'s)', reply: 'The 1944 spec with two rums.', newIngredients: [], drink: drink({ name: 'Mai Tai (1944 Original)', category: 'tiki', glass: 'dbl', method: 'shr',
    flavors: ['tropical', 'tart'], wellKnown: true, ingredients: [ing(1, 'oz', 'jrum'), ing(1, 'oz', 'agricole'), ing(.75, 'oz', 'lime'), ing(.5, 'oz', 'curacao'), ing(.5, 'oz', 'orgeat'), ing(.25, 'oz', 'simple')] }) }) });
  await page.click(`${top} [data-act="mk-better"]`);
  await settle();
  out.better = { text: await page.inputValue('#mk-text'), of: await page.textContent(`${top} .mk-of`), user: calls[calls.length - 1].body.messages[0].content };
  await shot('46-better.png');
  await page.click(`${top} [data-act="mk-add"]`);
  await page.waitForTimeout(250);
  out.betterAdded = await page.textContent(`${top} .mine-note`);
  answer = () => ({ json: MSG({ verdict: 'new', existing: '', reply: 'A mojito.', newIngredients: [], drink: drink({ name: 'Mojito', category: 'highball', glass: 'highball', method: 'mu',
    ingredients: [ing(10, 'count', 'mint'), ing(2, 'oz', 'wrum'), ing(.75, 'oz', 'lime'), ing(.75, 'oz', 'simple'), ing(0, 'top', 'soda')] }) }) });
  await page.click(`${top} [data-act="close"]`);
  await page.waitForTimeout(150);
  await page.click(`${top} [data-act="mk-better"]`);
  await page.fill('#mk-text', 'a mojito');
  await page.click(`${top} [data-act="mk-go"]`);
  await settle();
  out.sameName = { title: await page.textContent(`${top} .mk-card h2`), of: await page.textContent(`${top} .mk-of`) };
  await closeAll();

  // 6. guard rails: whiskey, a mixed-up answer, API errors, offline
  const runWith = async a => { answer = a; await page.click(`${top} [data-act="mk-go"]`); await settle(); return page.textContent(`${top} #mk-out`); };
  await tab('quiz');
  await page.fill('#ask-text', '');
  await page.click('[data-act="mk-from-ask"]');
  await page.fill('#mk-text', 'an old fashioned');
  out.whiskey = await runWith(() => ({ json: MSG({ verdict: 'new', existing: '', reply: 'Classic.', newIngredients: [{ name: 'Bourbon', plural: 'Bourbon', group: 'spirit', abv: 45, color: 'b0601f', tint: 'medium', flavors: [], ozPerPiece: 0 }],
    drink: drink({ name: 'Old Fashioned', ingredients: [ing(2, 'oz', 'new', { newName: 'Bourbon' }), ing(2, 'dash', 'angostura')] }) }) }));
  out.mixedUp = await runWith(() => ({ json: MSG({ verdict: 'new', existing: '', reply: 'x', newIngredients: [], drink: drink({ name: 'Mystery', ingredients: [ing(2, 'oz', 'new', { newName: 'Unicorn tears' })] }) }) }));
  out.authErr = await runWith(() => ({ status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }));
  out.refusal = await runWith(() => ({ json: Object.assign(MSG({}), { stop_reason: 'refusal', content: [] }) }));
  await shot('47-error.png');
  await ctx.setOffline(true);
  out.offline = await runWith(() => ({ json: MSG({}) }));
  await ctx.setOffline(false);
  out.emptyAsk = await (async () => { await page.fill('#mk-text', ''); await page.click(`${top} [data-act="mk-go"]`); return page.textContent(`${top} #mk-out`); })();
  await closeAll();

  // 7. the Mood tab hands its text over
  await tab('quiz');
  answer = b => b.output_config.format.schema.properties.picks
    ? { json: MSG({ reply: 'Frozen and fruity.', note: '', picks: [{ n: 10, why: 'Frozen.' }, { n: 20, why: 'Fruity.' }, { n: 30, why: 'Light.' }] }) }
    : { json: MSG(KIWI_COLADA) };
  const n0 = calls.length;
  await page.click('[data-act="mk-from-ask"]');
  out.boxEmpty = { open: await page.evaluate(() => !!document.querySelector('#layer > :last-child').dataset.make), called: calls.length - n0, text: await page.inputValue('#mk-text') };
  await closeAll();
  await page.fill('#ask-text', 'something sour with passion fruit');
  await page.click('[data-act="mk-from-ask"]');
  await settle();
  out.boxText = { text: await page.inputValue('#mk-text'), user: calls[calls.length - 1].body.messages[0].content };
  await closeAll();
  await page.fill('#ask-text', 'fruity and frozen, not too sweet');
  await page.click('#ask-go');
  await page.waitForSelector('#ask-results .make-cta');
  await shot('48-mood-cta.png', true);
  await page.click('#ask-results .make-cta [data-act="mk-open"]');
  await settle();
  out.mood = { text: await page.inputValue('#mk-text'), user: calls[calls.length - 1].body.messages[0].content, result: await page.textContent(`${top} .mk-card h2`) };
  await closeAll();

  // 8. remove, undo, and backup restore / clear
  await search('kiwi colada');
  await page.click('#results .row');
  await page.waitForTimeout(250);
  await page.click(`${top} [data-act="mine-rm"]`);
  await page.waitForTimeout(200);
  out.removed = { toast: await page.textContent('#toast'), results: await page.$$eval('#results .row-name', rs => rs.length), brand: await page.textContent('#brand-sub') };
  await page.click('#toast-undo');
  await page.waitForTimeout(200);
  out.undone = { results: await page.$$eval('#results .row-name', rs => rs.map(r => r.textContent)), fav: await page.evaluate(() => JSON.parse(localStorage.getItem('sipsail.favs')).includes('my-kiwi-colada')) };
  const backup = await page.evaluate(() => JSON.stringify({ app: 'sipsail', v: 1, settings: {}, favs: [], tried: {}, log: [], shop: [], mine: JSON.parse(localStorage.getItem('sipsail.mine')) }));
  out.mineStored = JSON.parse(backup).mine.map(m => m.id);
  await tab('guide');
  await page.evaluate(() => { document.querySelector('#g-settings').open = true; });
  await page.fill('#g-restore', backup.replace('Kiwi Colada|', 'Kiwi Colada Deluxe|'));
  await page.click('#g-settings [data-act="restore"]');
  await page.waitForTimeout(200);
  out.restored = await page.evaluate(() => JSON.parse(localStorage.getItem('sipsail.mine')).map(m => m.line.split('|')[0]));
  await page.click('#g-settings [data-act="reset"]');
  await page.click('#g-settings [data-act="reset"]');
  await page.waitForTimeout(200);
  out.cleared = { mine: await page.evaluate(() => localStorage.getItem('sipsail.mine')), brand: await page.textContent('#brand-sub') };

  // 9. no key: the sheet says so and points to Settings
  await page.evaluate(() => { sessionStorage.setItem('nokey', '1'); localStorage.removeItem('sipsail.apikey'); });
  await page.reload(); await page.waitForTimeout(400);
  await tab('quiz');
  await page.fill('#ask-text', '');
  await page.click('[data-act="mk-from-ask"]');
  out.noKeyHint = await page.textContent(`${top} #mk-out`);
  await shot('49-no-key.png');
  const before = calls.length;
  await page.fill('#mk-text', 'kiwi');
  await page.click(`${top} [data-act="mk-go"]`);
  out.noKey = { text: await page.textContent(`${top} #mk-out`), called: calls.length - before };

  console.log(JSON.stringify(Object.assign(out, { calls: calls.length, errors }), null, 1));
  await browser.close();
})();
