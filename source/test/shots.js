const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'dist', 'Sip-and-Sail.html');
const OUT = p => path.join(__dirname, 'shots', p);
(async () => {
  const browser = await chromium.launch();
  const scheme = process.argv[2] || 'light';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: scheme, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(FILE);
  await page.waitForTimeout(400);
  const sfx = scheme === 'dark' ? '-dark' : '';
  await page.screenshot({ path: OUT(`01-home${sfx}.png`) });
  await page.screenshot({ path: OUT(`02-home-full${sfx}.png`), fullPage: true });
  // drink detail
  await page.click('.carousel .dcard');
  await page.waitForTimeout(350);
  await page.screenshot({ path: OUT(`03-detail${sfx}.png`) });
  const panel = await page.$('.panel');
  await panel.evaluate(el => el.scrollTop = 700);
  await page.waitForTimeout(100);
  await page.screenshot({ path: OUT(`04-detail-scrolled${sfx}.png`) });
  // bartender card
  await panel.evaluate(el => el.scrollTop = 0);
  await page.click('[data-act="bartender"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT(`05-bartender${sfx}.png`) });
  await page.click('.bt-close');
  await page.click('.panel [data-act="close"]');
  await page.waitForTimeout(200);
  // surprise
  await page.click('[data-act="surprise"]');
  await page.waitForTimeout(2300);
  await page.screenshot({ path: OUT(`06-surprise${sfx}.png`) });
  await page.click('.spin-result [data-act="close"]');
  // browse
  await page.click('.tabs [data-go="browse"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT(`07-browse${sfx}.png`) });
  await page.fill('#q', 'coconut tequila');
  await page.waitForTimeout(300);
  const cnt1 = await page.textContent('#count');
  await page.screenshot({ path: OUT(`08-search${sfx}.png`) });
  await page.fill('#q', '');
  await page.waitForTimeout(250);
  await page.click('[data-act="filters"]');
  await page.waitForTimeout(250);
  // include Pineapple, exclude Cream (Milk & cream)
  await page.click('[data-act="ing"][data-k="Pineapple"]');
  await page.click('[data-act="ing"][data-k="Milk & cream"]');
  await page.click('[data-act="ing"][data-k="Milk & cream"]');
  await page.waitForTimeout(100);
  await page.screenshot({ path: OUT(`09-filters${sfx}.png`) });
  await page.click('.panel-bar [data-act="close"]');
  await page.waitForTimeout(300);
  const cnt2 = await page.textContent('#count');
  await page.screenshot({ path: OUT(`10-filtered${sfx}.png`) });
  // quiz
  await page.click('.tabs [data-go="quiz"]');
  for (const [q, k] of [['mood', 'chill'], ['where', 'pool'], ['flavor', 'fruity'], ['strength', '2'], ['spirit', 'tequila']]) {
    await page.click(`[data-act="answer"][data-q="${q}"][data-k="${k}"]`);
    await page.waitForTimeout(120);
    if (q === 'mood') await page.screenshot({ path: OUT(`11-quiz-q2${sfx}.png`) });
  }
  await page.screenshot({ path: OUT(`12-quiz-result${sfx}.png`) });
  const match = await page.textContent('.match h2');
  // log drinks and see tracker
  await page.click('.match [data-act="open"]');
  await page.waitForTimeout(250);
  await page.click('.panel [data-act="log"]');
  await page.click('.panel [data-act="log"]');
  await page.click('.panel [data-act="close"]');
  await page.click('.tabs [data-go="mybar"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT(`13-tracker${sfx}.png`), fullPage: true });
  // guide
  await page.click('.tabs [data-go="guide"]');
  await page.click('#g-pkg summary');
  await page.waitForTimeout(150);
  await page.screenshot({ path: OUT(`14-guide${sfx}.png`), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(JSON.stringify({ scheme, cnt1, cnt2, match, overflow, errors }, null, 1));
  await browser.close();
})();
