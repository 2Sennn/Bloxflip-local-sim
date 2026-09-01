# Bloxflip Local Sim

A Chrome extension that emulates Bloxflip. Mines, towers, dice, a fake wallet, fake game history, fake rain. You play on the real site but every request is answered locally, so the outcome is whatever you want it to be.

Bloxflip shut down on September 1st, 2026. All of this still loads and runs, it just doesn't have a live site to hook into anymore. I'm keeping it public because of the story behind it.

## Why this exists

While Bloxflip was up, there was a whole industry around paid "predictors" that claimed to predict RNG on gambling sites. People sold subscriptions, posted "proof" of wins, ran Discord servers full of happy customers.

RNG on gambling sites cannot be predicted. The site generates a random seed, hashes it, and the result is what it is. Anyone selling you a prediction is lying, and anyone showing you proof is faking the proof.

This extension is how that proof gets faked. Set your balance to something impressive, play a few "rounds", and suddenly your predictor wins every game. Screenshot it, post it, and the scam sells itself.

I know the trick from the inside. This repo is my way of showing how it was done, both to stop people falling for it and to own the fact that I was part of it.
Althought i took part in this scammy business, that was over 3 years ago, ive matured alot since then, Im making this public in an attempt to show that ive changed whether people choose to believe it or not.

## What it fakes

- **Mines** (5x5 grid), **towers** and **dice**, with the real payout math including the 0.95 house edge. Winning every round still looks correct.
- **Balance and username.** Set both in the popup. The session sticks across page refreshes, which is what makes "proof" hold up when someone actually watches you play.
- **Game history.** Fake games are merged into the real history endpoint so past games, current game and wallet all tell the same story.
- **Rain and socket events.** Fake rain events are pushed over the patched WebSocket so the live UI reacts like it's real.
- **A ghost request.** Every simulated call also fires a real XHR that gets aborted a moment later, purely so the request still shows up in the DevTools network tab. That one detail did more for believability than all the payout math combined.

## How it works

The extension injects at document_start in the MAIN world, before the site's own scripts get a chance to run. It wraps fetch, XMLHttpRequest and the WebSocket constructor, classifies every request by path, and serves simulated responses for anything game related. Everything else passes through untouched, so the rest of the site behaves normally.

The popup talks to the page through a small bridge script. There's no build step, no framework, just plain JS files loaded in order. Version 1.3.5 was the last one I shipped.

## Install

1. Clone this repo.
2. Open chrome://extensions.
3. Turn on Developer mode (top right corner).
4. Click "Load unpacked" and select this folder.
5. Go to bloxflip.com. If the site is still alive, you're in business.

## Usage

Click the extension icon to open the popup:

- **Balance** - your fake wallet.
- **Wager** - the default bet size.
- **Username** - the name displayed on your fake games and history.

Controls:

- Mines / towers: left click a safe tile, right click a bomb.
- Dice: you win unless you're holding Q.
- The refresh button in the popup resets the session.

If you ever need the sim fully out of the way without uninstalling, set `localStorage.setItem("bf_sim_off", "1")` before the page loads and it goes dormant.

## Don't be that guy

This exists to show how predictor scams work. Using it to sell "predictions" or fake win screenshots is the exact thing this repo is calling out.

And for what it's worth: even on a fair site, the house edge means you lose money over time. A predictor doesn't change that, it just adds a subscription fee on top. RNG can't be predicted. If someone is selling you predictions, they're scamming you.
