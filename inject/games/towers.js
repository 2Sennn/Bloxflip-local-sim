(function (S) {
  if (!S || S.off || S.skip) return;

  var ROW_MULT = { easy: 1.395, normal: 1.86, hard: 2.97 };

  S.tower = {
    live: false,
    bet: 1,
    diff: "easy",
    gid: null,
    rows: 8,
    cols: 3,
    bombsPer: 1,
    layout: null,
    picked: [],
  };

  function normTowerDiff(d) {
    d = String(d || "easy").toLowerCase();
    if (d === "medium" || d === "normal" || d === "medium_risk") return "normal";
    if (d === "hard" || d === "expert" || d === "high") return "hard";
    return "easy";
  }

  function applyTowerDiff(d) {
    S.tower.diff = normTowerDiff(d);
    if (S.tower.diff === "hard") {
      S.tower.cols = 3;
      S.tower.bombsPer = 2;
    } else if (S.tower.diff === "normal") {
      S.tower.cols = 2;
      S.tower.bombsPer = 1;
    } else {
      S.tower.cols = 3;
      S.tower.bombsPer = 1;
    }
  }

  function towerMult() {
    var n = S.tower.picked.length;
    if (n <= 0) return 1;
    var per = ROW_MULT[S.tower.diff] || ROW_MULT.easy;
    var m = 1,
      i;
    for (i = 0; i < n; i++) m *= per;
    return m;
  }

  function towerPayout() {
    return S.roundBal(S.tower.bet * towerMult());
  }

  function newTowerLayout() {
    var L = [],
      r,
      c;
    applyTowerDiff(S.tower.diff);
    for (r = 0; r < S.tower.rows; r++) {
      var row = [];
      for (c = 0; c < S.tower.cols; c++) row.push(0);
      var pool = [];
      for (c = 0; c < S.tower.cols; c++) pool.push(c);
      var n = Math.min(S.tower.bombsPer, S.tower.cols);
      while (n > 0 && pool.length) {
        var pick = (Math.random() * pool.length) | 0;
        row[pool[pick]] = 1;
        pool.splice(pick, 1);
        n -= 1;
      }
      L.push(row);
    }
    return L;
  }

  function towerForceCell(level, col, dead) {
    applyTowerDiff(S.tower.diff);
    if (!S.tower.layout) S.tower.layout = newTowerLayout();
    var row = S.tower.layout[level];
    if (!row) {
      row = [];
      for (var z = 0; z < S.tower.cols; z++) row.push(0);
      S.tower.layout[level] = row;
    }
    while (row.length < S.tower.cols) row.push(0);

    // 1=bomb. keep bombsPer or the whole losing row draws as X
    var i,
      bombs = 0;
    for (i = 0; i < S.tower.cols; i++) bombs += row[i] === 1 ? 1 : 0;

    if (dead) {
      if (row[col] !== 1) {
        row[col] = 1;
        bombs += 1;
      }
      for (i = 0; i < S.tower.cols && bombs > S.tower.bombsPer; i++) {
        if (i !== col && row[i] === 1) {
          row[i] = 0;
          bombs -= 1;
        }
      }
      for (i = 0; i < S.tower.cols && bombs < S.tower.bombsPer; i++) {
        if (i !== col && row[i] !== 1) {
          row[i] = 1;
          bombs += 1;
        }
      }
    } else {
      if (row[col] === 1) {
        row[col] = 0;
        bombs -= 1;
      }
      for (i = 0; i < S.tower.cols && bombs < S.tower.bombsPer; i++) {
        if (i !== col && row[i] !== 1) {
          row[i] = 1;
          bombs += 1;
        }
      }
      for (i = S.tower.cols - 1; i >= 0 && bombs > S.tower.bombsPer; i--) {
        if (i !== col && row[i] === 1) {
          row[i] = 0;
          bombs -= 1;
        }
      }
    }
  }

  function towerRevealOnDeath(level, col) {
    applyTowerDiff(S.tower.diff);
    var out = [],
      r,
      c;
    for (r = 0; r < S.tower.rows; r++) {
      var src = S.tower.layout && S.tower.layout[r] ? S.tower.layout[r] : null;
      var row = [];
      for (c = 0; c < S.tower.cols; c++) row.push(src && src[c] ? 1 : 0);
      if (r === level) row[col] = 1;
      out.push(row);
    }
    return out;
  }

  function towerHistRow(payout, exploded, deathLayout) {
    return {
      uuid: S.tower.gid,
      betAmount: S.tower.bet,
      payout: payout || 0,
      difficulty: S.tower.diff,
      towerLevels: deathLayout || S.tower.layout || [],
      completedLevels: S.tower.picked.slice(),
      clientSeed: S.wallet.clientSeed,
      nonce: S.wallet.nonce,
      exploded: !!exploded,
      active: false,
      currency: "FLIPCOINS",
      created: Date.now(),
      userId: S.wallet.profileId,
    };
  }

  function towerGame(extra) {
    var tower = S.tower;
    var g = {
      uuid: tower.gid,
      betAmount: tower.bet,
      payout: 0,
      clientSeed: S.wallet.clientSeed,
      nonce: S.wallet.nonce,
      difficulty: tower.diff,
      columns: tower.cols,
      completedLevels: tower.picked.slice(),
      userId: S.wallet.profileId,
      created: Date.now(),
      active: tower.live,
      exploded: false,
      currency: "FLIPCOINS",
    };
    if (extra) {
      for (var k in extra) g[k] = extra[k];
    }
    return g;
  }

  S.simTowers = function (method, path, body) {
    body = body || {};
    var tower = S.tower;

    if (S.pathIs(method, path, { m: "GET", p: "/games/towers" })) {
      if (!tower.live) return { success: true, hasGame: false };
      return {
        success: true,
        hasGame: true,
        multiplier: towerMult(),
        game: towerGame({ active: true }),
      };
    }

    if (
      S.pathIs(method, path, { m: "POST", p: "/games/towers/create" }) ||
      S.pathIs(method, path, { m: "POST", p: "/games/towers" })
    ) {
      S.dbg("towers create intercepted", path);
      var bet = Math.max(0.1, parseFloat(body.betAmount) || 0.1);
      if (S.wallet.flip != null && S.wallet.flip < bet) {
        return {
          success: false,
          msg: "Insufficient balance",
          error: "Insufficient balance",
          message: "Insufficient balance",
          _status: 400,
        };
      }

      tower.live = true;
      tower.bet = bet;
      applyTowerDiff(body.difficulty || body.diff || "easy");
      tower.picked = [];
      tower.gid = S.uuid();
      tower.layout = newTowerLayout();
      S.bumpNonce();
      S.walletMove(-tower.bet);
      S.trackWager(tower.bet);
      S.pushTx("play", -tower.bet, "towers");
      S.injectLiveFeed("towers", "play", tower.bet, 0);
      S.dbg("towers create", tower.gid, tower.diff, tower.cols + "col", tower.bombsPer + "x");
      S.saveSession();

      return {
        success: true,
        game: towerGame({
          active: true,
          difficulty: tower.diff,
          columns: tower.cols,
          serverHash: S.uuid().replace(/-/g, ""),
        }),
        uuid: tower.gid,
        gameEvents: [{ _id: S.uuid(), amount: -tower.bet, currency: "FLIPCOINS" }],
      };
    }

    if (S.pathIs(method, path, { m: "POST", p: "/games/towers/action" })) {
      if (!tower.live) {
        return { success: false, msg: "No active towers game", _status: 400 };
      }

      if (body.cashout === true) {
        if (!tower.picked.length) {
          return {
            success: false,
            msg: "You must select at least one tile before cashing out",
            error: "You must select at least one tile before cashing out",
            _status: 400,
          };
        }

        var w = towerPayout();
        var m = towerMult();

        tower.live = false;
        S.walletMove(w);
        S.pushTx("win", w, "towers");
        S.injectLiveFeed("towers", "win", tower.bet, w);
        S.ledger.towers.unshift(towerHistRow(w, false));
        return {
          success: true,
          multiplier: m,
          winnings: w,
          gameEvents: [{ _id: S.uuid(), amount: w, currency: "FLIPCOINS" }],
          game: towerGame({
            active: false,
            towerLevels: tower.layout,
            serverSeed: S.uuid().replace(/-/g, "") + S.uuid().replace(/-/g, ""),
          }),
        };
      }

      var lvl = parseInt(body.towerLevel, 10);
      var col = parseInt(body.tile, 10);
      if (!isFinite(lvl)) lvl = tower.picked.length;
      if (!isFinite(col)) col = 0;

      var tb = S.tileBias;
      S.tileBias = null;

      if (!tower.layout) tower.layout = newTowerLayout();
      if (tb === "bomb") towerForceCell(lvl, col, true);
      else if (tb === "win") towerForceCell(lvl, col, false);

      var row = tower.layout[lvl];
      var dead = !!(row && row[col] === 1);

      S.dbg("towers tile", lvl, col, "dead", dead, "bias", tb, tower.diff);

      if (dead) {
        var deathBoard = towerRevealOnDeath(lvl, col);
        tower.layout = deathBoard;
        tower.live = false;
        S.ledger.towers.unshift(towerHistRow(0, true, deathBoard));
        S.injectLiveFeed("towers", "lose", tower.bet, 0);
        S.saveSession();
        return {
          success: true,
          exploded: true,
          tile: col,
          towerLevel: lvl,
          game: towerGame({
            active: false,
            exploded: true,
            towerLevels: deathBoard,
            failedLevel: lvl,
            failedTile: col,
            badTile: col,
            completedLevels: tower.picked.slice(),
            serverSeed: S.uuid().replace(/-/g, "") + S.uuid().replace(/-/g, ""),
          }),
        };
      }

      tower.picked.push(col);
      S.saveSession();
      if (tower.picked.length >= tower.rows) {
        return S.simTowers("POST", path, { cashout: true });
      }
      return {
        success: true,
        completedLevels: tower.picked.slice(),
        exploded: false,
        difficulty: tower.diff,
      };
    }

    return null;
  };
})(window.BfSim);
