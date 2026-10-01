const fs = require('fs');
const path = require('path');
const core = require('./src/core.js');
const dir = path.join(__dirname, 'data');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
const ingText = fs.readFileSync(path.join(dir, '00-ingredients.txt'), 'utf8');
const recipeText = files.filter(f => !f.startsWith('00') && !f.startsWith('90')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const listText = fs.readFileSync(path.join(dir, '90-lists.txt'), 'utf8');
const d = core.parseData(ingText, recipeText, listText);
console.log('ingredients:', Object.keys(d.ING).length, 'recipes:', d.recipes.length, 'errors:', d.errors.length);
d.errors.forEach(e => console.log('  ERR', e));
const byCat = {};
d.recipes.forEach(r => byCat[r.cat] = (byCat[r.cat] || 0) + 1);
console.log(byCat);
const used = new Set(); d.recipes.forEach(r => r.items.forEach(i => used.add(i.key)));
console.log('unused ingredients:', Object.keys(d.ING).filter(k => !used.has(k)).join(', '));
// whiskey guard
const bad = d.recipes.filter(r => /whisk|bourbon|scotch|rye\b|fireball|crown royal|jameson|jack daniel|southern comfort|drambuie/i.test(r.items.map(i => i.key + ' ' + i.mod).join(' ')));
console.log('whiskey hits:', bad.map(r => r.name));
if (process.argv[2] === 'show') {
  for (const r of d.recipes) console.log(r.cat.padEnd(8), r.std.toFixed(2).padStart(5), core.STRENGTH[r.strength].padEnd(11), r.color, r.base.padEnd(18), r.name, '|', [...r.tags].join(','));
}
if (process.argv[2] === 'one') {
  const r = d.byName.get(core.norm(process.argv[3]));
  console.log(r.name, r.std.toFixed(2), r.color, r.base, [...r.tags]);
  r.items.forEach(i => console.log('  ', core.itemPlain(i, d.ING, 'both')));
  core.steps(r, d.ING, 'both').forEach(s => console.log('  >', s));
  console.log('  say:', core.orderLine(r, d.ING));
  console.log('  similar:', core.similar(r, d.recipes, 6).map(x => x.name).join(' · '));
}
