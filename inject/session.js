(function (S) {
  if (!S || S.off || S.skip) return;

  var TX_LABEL = {
    mines: { play: "Mines Game Play", win: "Mines Game Win" },
    towers: { play: "Towers Game Play", win: "Towers Game Win" },
    dice: { play: "Dice Game Play", win: "Dice Game Win" },
    rain: { play: "Rain Join", win: "Rain Win" },
  };

  S.wallet = {
    flip: null,
    profileId: null,
    username: null,
    startBalance: null,
    startWager: null,
    clientSeed: "019ef00c-e10a-789e-b9b7-11d079c07270",
    nonce: 6460 + Math.floor(Math.random() * 80),
    touched: false,
    baseTotalPlayed: null,
    simWager: 0,
    sessionLocked: false,
  };

  S.ledger = {
    mines: [],
    towers: [],
    games: {},
    txs: [],
  };

  S.feedBuf = [];
  S.chatOnline = 500;

  S.ensureGameLedger = function (mode) {
    if (!S.ledger.games[mode]) S.ledger.games[mode] = [];
    return S.ledger.games[mode];
  };

  S.ingestUser = function (j) {
    if (!j) return;
    var w = S.wallet;
    if (!w.sessionLocked) {
      if (j.profile && j.profile.id) w.profileId = j.profile.id;
      if (j.profile && j.profile.username) w.username = j.profile.username;
    }
    if (j.wallet && j.wallet.balances && j.wallet.balances.FLIPCOINS != null) {
      if (w.flip == null && !w.sessionLocked) w.flip = j.wallet.balances.FLIPCOINS;
    }
    if (j.stats && j.stats.totalPlayed != null && w.baseTotalPlayed == null && !w.sessionLocked) {
      w.baseTotalPlayed = j.stats.totalPlayed;
    }
  };

  S.sessionSnapshot = function () {
    var w = S.wallet;
    return {
      startBalance: w.startBalance,
      startWager: w.startWager,
      username: w.username,
      userId: w.profileId,
      flip: w.flip,
      simWager: w.simWager,
      baseTotalPlayed: w.baseTotalPlayed,
      clientSeed: w.clientSeed,
      nonce: w.nonce,
      touched: w.touched,
      sessionLocked: w.sessionLocked,
      ledger: {
        mines: S.ledger.mines,
        towers: S.ledger.towers,
        games: S.ledger.games,
        txs: S.ledger.txs,
      },
      live: {
        mines: S.mines,
        tower: S.tower,
        rain: S.rain,
      },
      feed: S.feedBuf,
      chatOnline: S.chatOnline,
    };
  };

  S.saveSession = function () {
    var snap = S.sessionSnapshot();
    try {
      localStorage.setItem(S.sessionKey, JSON.stringify(snap));
    } catch (e) {
      // quota / privacy mode
    }
    try {
      window.postMessage({ source: "lxs-page", type: "LXS_PERSIST", session: snap }, "*");
    } catch (e2) {
      // detached window during unload
    }
    try {
      document.dispatchEvent(new CustomEvent("lxs-persist", { detail: snap }));
    } catch (e3) {
      // document_start before document is usable, or clone failure
    }
  };

  S.loadSession = function () {
    try {
      var raw = localStorage.getItem(S.sessionKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // blocked storage or corrupt JSON
    }
    return null;
  };

  S.nudgeUserUi = function () {
    window.dispatchEvent(new Event("focus"));
  };

  S.applySessionConfig = function (cfg) {
    if (!cfg) return;
    var w = S.wallet;
    w.sessionLocked = true;
    w.touched = true;

    if (cfg.username) w.username = cfg.username;
    if (cfg.userId) w.profileId = cfg.userId;
    if (cfg.startBalance != null) w.startBalance = cfg.startBalance;
    if (cfg.startWager != null) {
      w.startWager = cfg.startWager;
      if (w.baseTotalPlayed == null) w.baseTotalPlayed = cfg.startWager;
    }
    if (cfg.baseTotalPlayed != null) w.baseTotalPlayed = cfg.baseTotalPlayed;
    if (cfg.clientSeed) w.clientSeed = cfg.clientSeed;
    if (cfg.nonce != null) w.nonce = cfg.nonce;

    if (cfg.fresh) {
      w.flip = cfg.startBalance != null ? cfg.startBalance : w.flip;
      w.simWager = 0;
      w.baseTotalPlayed = cfg.startWager != null ? cfg.startWager : 0;
      S.ledger.mines = [];
      S.ledger.towers = [];
      S.ledger.games = {};
      S.ledger.txs = [];
      S.mines.live = false;
      S.mines.opened = [];
      S.tower.live = false;
      S.tower.picked = [];
      S.rain.active = false;
      S.rain.fake = false;
    } else {
      if (cfg.flip != null) w.flip = cfg.flip;
      else if (w.flip == null && cfg.startBalance != null) w.flip = cfg.startBalance;
      if (cfg.simWager != null) w.simWager = cfg.simWager;
      if (cfg.ledger) {
        S.ledger.mines = cfg.ledger.mines || S.ledger.mines;
        S.ledger.towers = cfg.ledger.towers || S.ledger.towers;
        S.ledger.games = cfg.ledger.games || S.ledger.games;
        S.ledger.txs = cfg.ledger.txs || S.ledger.txs;
      }
      if (cfg.live) {
        if (cfg.live.mines) S.copyFields(S.mines, cfg.live.mines);
        if (cfg.live.tower) S.copyFields(S.tower, cfg.live.tower);
        if (cfg.live.rain) {
          S.copyFields(S.rain, cfg.live.rain);
          if (S.rain.active && (!S.rain.endsAt || Date.now() >= S.rain.endsAt)) {
            S.rain.active = false;
            S.rain.fake = false;
          }
        }
      }
      if (cfg.feed && cfg.feed.length) S.feedBuf = cfg.feed.slice(0, 40);
      if (cfg.chatOnline) S.chatOnline = cfg.chatOnline;
    }

    S.saveSession();
    S.nudgeUserUi();
  };

  S.totalWager = function () {
    var w = S.wallet;
    if (w.sessionLocked && w.startWager != null) {
      return S.roundBal(w.startWager + w.simWager);
    }
    var base = w.baseTotalPlayed != null ? w.baseTotalPlayed : 0;
    return S.roundBal(base + w.simWager);
  };

  S.applyXpToLevel = function () {
    var w = S.totalWager();
    var L;
    if (w <= 0) return { level: 1, pct: 0 };
    if (w <= 3900000) L = 1 + 16 * (w / 3900000);
    else if (w <= 13402305) L = 17 + 20 * ((w - 3900000) / (13402305 - 3900000));
    else L = 37 + 213 * (1 - Math.exp(-(w - 13402305) / 80000000));
    if (L > 250) L = 250;
    var whole = Math.max(1, Math.min(250, Math.floor(L)));
    var pct = whole >= 250 ? 99.99 : S.roundBal((L - whole) * 100);
    return { level: whole, pct: pct };
  };

  S.applyUserPatch = function (j) {
    if (!j) return j;
    var w = S.wallet;
    if (w.sessionLocked && w.username && j.profile) {
      j.profile.username = w.username;
    }
    if ((w.touched || w.sessionLocked) && w.flip != null) {
      if (j.wallet && j.wallet.balances) j.wallet.balances.FLIPCOINS = w.flip;
      if (j.wallet && j.wallet.balance != null) j.wallet.balance = w.flip;
      if (j.balances && typeof j.balances === "object") j.balances.FLIPCOINS = w.flip;
      if (j.balance != null) j.balance = w.flip;
    }
    if (j.stats) {
      var played = S.totalWager();
      if (w.sessionLocked && w.startWager != null) {
        j.stats.totalPlayed = played;
      } else if (w.simWager > 0) {
        var base = w.baseTotalPlayed != null ? w.baseTotalPlayed : j.stats.totalPlayed || 0;
        played = S.roundBal(base + w.simWager);
        j.stats.totalPlayed = played;
      }
      if (j.stats.wagered != null || w.simWager > 0) j.stats.wagered = played;
      if (j.stats.wager != null) j.stats.wager = played;
      if (j.stats.totalWagered != null) j.stats.totalWagered = played;
    }
    if (j.profile && (w.simWager > 0 || w.sessionLocked)) {
      var xp = S.applyXpToLevel();
      j.profile.level = xp.level;
      j.profile.nextLevelPercentage = xp.pct;
    }
    return j;
  };

  S.walletMove = function (delta) {
    var w = S.wallet;
    w.touched = true;
    if (w.flip == null) w.flip = 100;
    w.flip = S.roundBal(w.flip + delta);
    S.injectWalletSock(delta);
    S.saveSession();
  };

  S.trackWager = function (amt) {
    S.wallet.simWager = S.roundBal(S.wallet.simWager + amt);
    S.saveSession();
  };

  S.pushTx = function (action, signedAmount, gameKey) {
    var id = S.uuid();
    var shortId = id.replace(/-/g, "").slice(0, 8);
    var pack = TX_LABEL[gameKey] || { play: gameKey + " Game Play", win: gameKey + " Game Win" };
    var title = action === "win" ? pack.win : pack.play;
    var now = Date.now();
    var amt = S.roundBal(signedAmount);

    S.ledger.txs.unshift({
      id: shortId,
      _id: id,
      transactionId: id,
      uuid: id,
      event: title,
      eventName: title,
      description: title,
      name: title,
      title: title,
      label: title,
      amount: amt,
      value: amt,
      currency: "FLIPCOINS",
      created: now,
      createdAt: now,
      timestamp: now,
      date: now,
      game: gameKey,
      gameType: gameKey.toUpperCase(),
      type: action === "win" ? "WIN" : "PLAY",
      _lxs: true,
    });
    if (S.ledger.txs.length > 200) S.ledger.txs.pop();
    S.saveSession();
  };

  S.bumpNonce = function () {
    S.wallet.nonce += 1;
  };

  // ws.js replaces these after it loads.
  S.injectLiveFeed = function () {};
  S.injectWalletSock = function () {};
  S.broadcastSock = function () {};

  S.mergeTxPayload = function (serverJson) {
    var out = serverJson || { success: true, data: [] };
    var real = (out.data || out.transactions || []).filter(function (r) {
      return !r || !r._lxs;
    });
    var merged = S.ledger.txs.concat(real);
    out.data = merged;
    out.transactions = merged;
    return out;
  };
})(window.BfSim);
