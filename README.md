# Sip & Sail

An offline cruise drink companion: 530 whiskey-free recipes, ingredient filters, a "how am I feeling?" quiz, a "what are you in the mood for?" box, Surprise Me, big-text bartender cards, a drink-package value tracker, and a guide to the Celebrity Premium package, Celebrity Equinox bars and local drinks in port.

**Open it:** https://porkupine0.github.io/sip-and-sail/

## Put it on your phone (works with no internet)

- **iPhone:** open the link in Safari, tap Share, then **Add to Home Screen**. Open it once while online; after that it works in airplane mode.
- **Android:** open the link in Chrome, tap ⋮, then **Install app**.
- **Single file:** `Sip-and-Sail.html` is the whole app in one file. It runs offline in any desktop or Android browser.

Favorites, ratings, notes and the tracker are saved on the phone. Use Guide → Settings & backup to copy them to another phone.

## Describe it (optional Claude API key)

The Mood tab starts with a box: type what you're in the mood for ("fruity and frozen, not too sweet", "like a margarita but different") and get five picks from the app's own recipes.

- **With a connection and a Claude API key**, Claude reads what you wrote, along with your ratings and saved drinks, and picks from the full recipe list. Add the key in Settings: sign in at [console.anthropic.com](https://console.anthropic.com/settings/keys), add a little credit under Billing (a monthly spend limit is a good idea), create a key under API keys and paste it in. Each question costs a few cents, billed to your Anthropic account. The key stays on the phone and isn't in backup codes.
- **Offline or without a key**, it matches by keywords (flavors, spirits, strength, "no alcohol", a drink's name), right on the phone. The single-file version always works this way.

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
cp -r dist/web/. .. && cp dist/Sip-and-Sail.html ..
```

GitHub Pages serves the site from the `gh-pages` branch, so push changes to both branches:

```
git push origin main main:gh-pages
```

Unofficial guide, not affiliated with Celebrity Cruises. Drink responsibly.
