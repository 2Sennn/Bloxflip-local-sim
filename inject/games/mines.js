(function (S) {
  if (!S || S.off || S.skip) return;

  S.mines = {
    live: false,
    bet: 1,
    count: 3,
    gridDim: 5,
    cells: 25,
    opened: [],
    gid: null,
    badTile: -1,
    bombs: [],
    seen: {},
  };
  S.minesLastCashout = null;

  function nCr(n, r) {
    if (r < 0 || r > n) return 0;
    r = Math.min(r, n - r);
    var x = 1,
      i;
    for (i = 1; i <= r; i++) x = (x * (n - r + i)) / i;
    return x;
  }

  function minesMult() {
    var mines = S.mines;
    var k = mines.opened.length;
    if (k <= 0) return 1;
    var safes = mines.cells - mines.count;
    if (safes <= 0) return 1;
    var bot = nCr(safes, k);
    if (!bot) return 1;
    var m = (nCr(mines.cells, k) / bot) * 0.95;
    if (!isFinite(m) || m < 1) return 1;
    return m;
  }

  function minesPayout() {
    if (!S.mines.opened.length) return S.roundBal(S.mines.bet);
    return S.roundBal(S.mines.bet * minesMult());
  }

  function rollMineBombs(count, cells) {
    var pool = [],
      i,
      bombs = [];
    for (i = 0; i < cells; i++) pool.push(i);
    while (bombs.length < count && pool.length) {
      var pick = (Math.random() * pool.length) | 0;
      bombs.push(pool[pick]);
      pool.splice(pick, 1);
    }
    return bombs.sort(function (a, b) {
      return a - b;
    });
  }

  function mineIsBomb(tile) {
    return S.mines.bombs.indexOf(tile) >= 0;
  }

  function forceMineSafe(tile) {
    if (!mineIsBomb(tile)) return;
    var i,
      swap = -1;
    for (i = 0; i < S.mines.cells; i++) {
      if (S.mines.opened.indexOf(i) < 0 && i !== tile && !mineIsBomb(i)) {
        swap = i;
        break;
      }
    }
    var ix = S.mines.bombs.indexOf(tile);
    if (swap < 0) {
      if (ix >= 0) S.mines.bombs.splice(ix, 1);
      return;
    }
    S.mines.bombs[ix] = swap;
  }

  function forceMineBomb(tile) {
    if (mineIsBomb(tile)) return;
    var i,
      drop = -1;
    for (i = 0; i < S.mines.bombs.length; i++) {
      if (S.mines.opened.indexOf(S.mines.bombs[i]) < 0 && S.mines.bombs[i] !== tile) {
        drop = i;
        break;
      }
    }
    if (drop >= 0) S.mines.bombs[drop] = tile;
    else S.mines.bombs.push(tile);
  }

  function buildMineLocations(badTile) {
    var locs = S.mines.bombs.slice();
    if (badTile != null && badTile >= 0 && locs.indexOf(badTile) < 0) locs.push(badTile);
    return locs.sort(function (a, b) {
      return a - b;
    });
  }

  function minesHistRow(payout, exploded, badTile) {
    return {
      uuid: S.mines.gid,
      betAmount: S.mines.bet,
      payout: payout || 0,
      minesAmount: S.mines.count,
      gridSize: S.mines.gridDim,
      mineLocations: buildMineLocations(badTile),
      uncoveredLocations: S.mines.opened.slice(),
      badMineUncovered: badTile != null ? badTile : -1,
      clientSeed: S.wallet.clientSeed,
      nonce: S.wallet.nonce,
      exploded: !!exploded,
      active: false,
      currency: "FLIPCOINS",
      created: Date.now(),
      userId: S.wallet.profileId,
    };
  }

  function minesGame(extra, revealMines) {
    var mines = S.mines;
    var g = {
      uuid: mines.gid,
      betAmount: mines.bet,
      payout: 0,
      clientSeed: S.wallet.clientSeed,
      nonce: S.wallet.nonce,
      minesAmount: mines.count,
      mineLocations: revealMines ? buildMineLocations(mines.badTile) : [],
      uncoveredLocations: mines.opened.slice(),
      revealedDiamonds: [],
      revealedMines: [],
      badMineUncovered: mines.badTile >= 0 ? mines.badTile : -1,
      userId: S.wallet.profileId,
      created: Date.now(),
      active: mines.live,
      exploded: false,
      currency: "FLIPCOINS",
      gridSize: mines.gridDim,
    };
    if (extra) {
      for (var k in extra) g[k] = extra[k];
    }
    return g;
  }

  function finishMinesCashout() {
    if (!S.mines.opened.length) {
      return {
        success: false,
        msg: "You must uncover at least one tile before cashing out",
        error: "You must uncover at least one tile before cashing out",
        _status: 400,
      };
    }

    var win = minesPayout();
    var mult = minesMult();
    var mines = S.mines;

    mines.live = false;
    S.walletMove(win);
    S.pushTx("win", win, "mines");
    S.injectLiveFeed("mines", "win", mines.bet, win);
    S.ledger.mines.unshift(minesHistRow(win, false, null));
    S.saveSession();
    var payload = {
      success: true,
      multiplier: mult,
      winnings: win,
      exploded: false,
      gameEvents: [{ _id: S.uuid(), amount: win, currency: "FLIPCOINS" }],
      game: minesGame(
        {
          active: false,
          payout: win,
          exploded: false,
          serverSeed: S.uuid().replace(/-/g, "") + S.uuid().replace(/-/g, ""),
        },
        true
      ),
    };
    S.minesLastCashout = payload;
    return payload;
  }

  S.simMines = function (method, path, body) {
    body = body || {};
    var mines = S.mines;

    if (S.pathIs(method, path, { m: "GET", p: "/games/mines" })) {
      if (!mines.live) return { success: true, hasGame: false };
      return {
        success: true,
        hasGame: true,
        multiplier: minesMult(),
        game: minesGame({ active: true }),
      };
    }

    if (S.pathIs(method, path, { m: "POST", p: "/games/mines/create" })) {
      var gridN = parseInt(body.grid, 10) || 5;
      if (gridN < 2) gridN = 2;
      if (gridN > 10) gridN = 10;
      var cells = gridN * gridN;
      var maxMines = Math.max(1, cells - 1);
      var want = parseInt(body.mines, 10);
      if (!isFinite(want) || want < 1) want = 3;
      if (want > maxMines) want = maxMines;

      var bet = S.roundBal(Math.max(0.1, parseFloat(body.betAmount) || 0.1));
      if (S.wallet.flip != null && S.wallet.flip < bet) {
        return {
          success: false,
          msg: "Insufficient balance",
          error: "Insufficient balance",
          message: "Insufficient balance",
          _status: 400,
        };
      }

      mines.live = true;
      mines.bet = bet;
      mines.count = want;
      mines.gridDim = gridN;
      mines.cells = cells;
      mines.opened = [];
      mines.seen = {};
      mines.badTile = -1;
      mines.gid = S.uuid();
      mines.bombs = rollMineBombs(mines.count, mines.cells);
      S.minesLastCashout = null;
      S.bumpNonce();
      S.walletMove(-mines.bet);
      S.trackWager(mines.bet);
      S.pushTx("play", -mines.bet, "mines");
      S.injectLiveFeed("mines", "play", mines.bet, 0);
      S.dbg("mines create", mines.gid, "mines", mines.count, "/", mines.cells);
      S.saveSession();

      return {
        success: true,
        game: minesGame({ active: true, serverHash: S.uuid().replace(/-/g, "") }, false),
        uuid: mines.gid,
        gameEvents: [{ _id: S.uuid(), amount: -mines.bet, currency: "FLIPCOINS" }],
      };
    }

    if (S.pathIs(method, path, { m: "POST", p: "/games/mines/action" })) {
      var wantCash = body && (body.cashout === true || body.cashout === "true" || body.action === "cashout");
      if (!mines.live) {
        if (wantCash && S.minesLastCashout) return S.minesLastCashout;
        return {
          success: false,
          msg: "You do not have an active mines game!",
          error: "You do not have an active mines game!",
          _status: 400,
        };
      }

      if (wantCash) {
        return finishMinesCashout();
      }

      var tile = parseInt(body.mine, 10);
      if (!isFinite(tile) || tile < 0 || tile >= mines.cells) {
        return { success: true, multiplier: minesMult(), exploded: false };
      }

      if (mines.seen[tile] || mines.opened.indexOf(tile) >= 0) {
        return {
          success: true,
          multiplier: minesMult(),
          exploded: false,
          uncoveredLocations: mines.opened.slice(),
        };
      }
      mines.seen[tile] = 1;

      // Unbiased picks are still forced safe. Only an explicit bomb bias explodes.
      var bias = S.tileBias;
      if (bias === "bomb") forceMineBomb(tile);
      else forceMineSafe(tile);

      var boom = mineIsBomb(tile);
      if (bias === "bomb") S.tileBias = null;
      S.dbg("mines tile", tile, "boom", boom, "bias", bias, "opened", mines.opened.length);

      if (boom) {
        mines.badTile = tile;
        mines.live = false;
        S.ledger.mines.unshift(minesHistRow(0, true, tile));
        S.saveSession();
        S.injectLiveFeed("mines", "lose", mines.bet, 0);
        return {
          success: true,
          exploded: true,
          game: minesGame(
            {
              active: false,
              exploded: true,
              badMineUncovered: tile,
              serverSeed: S.uuid().replace(/-/g, "") + S.uuid().replace(/-/g, ""),
            },
            true
          ),
        };
      }

      mines.opened.push(tile);
      S.saveSession();
      return {
        success: true,
        multiplier: minesMult(),
        exploded: false,
        uncoveredLocations: mines.opened.slice(),
        game: minesGame({ active: true }),
      };
    }

    return null;
  };
})(window.BfSim);
