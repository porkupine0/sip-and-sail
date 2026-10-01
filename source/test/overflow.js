const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'Sip-and-Sail.html'));
  for (const v of ['home', 'browse', 'quiz', 'mybar', 'guide']) {
    await page.evaluate(v => document.querySelector(`.tabs [data-go="${v}"]`).click(), v);
    await page.waitForTimeout(200);
    const res = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > W + 1) {
          // skip descendants of horizontal scrollers
          let p = el.parentElement, inScroller = false;
          while (p) { const cs = getComputedStyle(p); if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') { inScroller = true; break; } p = p.parentElement; }
          if (!inScroller) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
        }
      });
      return { W, sw: document.documentElement.scrollWidth, iw: window.innerWidth, vv: window.visualViewport && window.visualViewport.width, items: out.slice(0, 12) };
    });
    console.log(v, JSON.stringify(res));
  }
  await browser.close();
})();
