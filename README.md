# Sip & Sail

An offline cruise drink companion: 530 whiskey-free recipes, ingredient filters, a "how am I feeling?" quiz, Surprise Me, big-text bartender cards, a drink-package value tracker, and a guide to the Celebrity Premium package, Celebrity Equinox bars and local drinks in port.

**Open it:** https://porkupine0.github.io/sip-and-sail/

## Put it on your phone (works with no internet)

- **iPhone:** open the link in Safari, tap Share, then **Add to Home Screen**. Open it once while online; after that it works in airplane mode.
- **Android:** open the link in Chrome, tap ⋮, then **Install app**.
- **Single file:** `Sip-and-Sail.html` is the whole app in one file. It runs offline in any desktop or Android browser.

Favorites, ratings, notes and the tracker are saved on the phone. Use Guide → Settings & backup to copy them to another phone.

## Editing the drinks

The source lives in `source/`. Recipes are plain text in `source/data/*.txt`, one drink per line:

```
Name|tags|glass|method|ingredients|garnish|note
```

Ingredients are `amount key` pairs separated by `;` (keys are listed in `00-ingredients.txt`). Rebuild with:

```
cd source
node validate.js        # checks every recipe
SITE_URL="https://porkupine0.github.io/sip-and-sail/" node build.js
cp dist/web/* .. && cp dist/Sip-and-Sail.html ..
```

Unofficial guide, not affiliated with Celebrity Cruises. Drink responsibly.
