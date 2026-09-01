(function (S) {
  if (!S || S.off || S.skip) return;

  function pullBet(body) {
    if (!body || typeof body !== "object") return 0;
    var n = body.betAmount != null ? body.betAmount : body.bet;
    if (n == null) n = body.amount != null ? body.amount : body.wager;
    if (n == null && body.game) {
      n = body.game.betAmount != null ? body.game.betAmount : body.game.bet;
    }
    if (n != null) return Math.abs(parseFloat(n)) || 0;
    return 0;
  }

  function diceHistRow(mode, bet, payout, won, extra) {
    var row = {
      uuid: S.uuid(),
      id: S.uuid(),
      betAmount: bet,
      bet: bet,
      payout: payout || 0,
      winnings: payout || 0,
      multiplier: payout > 0 && bet > 0 ? S.roundBal(payout / bet) : 0,
      isWin: !!won,
      win: !!won,
      currency: "FLIPCOINS",
      clientSeed: S.wallet.clientSeed,
      nonce: S.wallet.nonce,
      userId: S.wallet.profileId,
      created: Date.now(),
      active: false,
      gamemode: mode,
      _lxs: true,
    };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) row[k] = extra[k];
      }
    }
    return row;
  }

  function diceRoll(ranges, wantWin) {
    ranges = ranges && ranges.length ? ranges : [{ min: 50, max: 99.99 }];
    var i, lo, hi, n, t, inside, r;
    if (wantWin) {
      r = ranges[0];
      lo = Number(r.min);
      hi = Number(r.max);
      if (!isFinite(lo)) lo = 50;
      if (!isFinite(hi)) hi = 99.99;
      if (hi <= lo) hi = lo + 0.01;
      return S.roundBal(lo + Math.random() * (hi - lo));
    }
    for (t = 0; t < 80; t++) {
      n = S.roundBal(Math.random() * 99.99);
      inside = false;
      for (i = 0; i < ranges.length; i++) {
        lo = Number(ranges[i].min);
        hi = Number(ranges[i].max);
        if (n >= lo && n <= hi) {
          inside = true;
          break;
        }
      }
      if (!inside) return n;
    }
    lo = Number(ranges[0].min);
    return lo > 1 ? 0.01 : 99.99;
  }

  S.simDice = function (method, path, body) {
    if (method !== "POST") return null;
    body = body || {};
    var bet = parseFloat(body.bet) || pullBet(body) || 1;
    if (S.wallet.flip != null && S.wallet.flip < bet) {
      return { success: false, message: "Insufficient balance", _status: 400 };
    }
    var ranges = Array.isArray(body.ranges) && body.ranges.length ? body.ranges : [{ min: 50, max: 99.99 }];
    var wantWin = !S.qHeld;
    var roll = diceRoll(ranges, wantWin);
    var isWin = false;
    var i, lo, hi, span = 0;
    for (i = 0; i < ranges.length; i++) {
      lo = Number(ranges[i].min);
      hi = Number(ranges[i].max);
      span += Math.max(0, hi - lo);
      if (roll >= lo && roll <= hi) isWin = true;
    }
    if (wantWin && !isWin) {
      roll = diceRoll(ranges, true);
      isWin = true;
    }
    if (!wantWin && isWin) {
      roll = diceRoll(ranges, false);
      isWin = false;
    }
    var probability = S.roundBal(span / 99.99) || 0.5;
    var multiplier = parseFloat(body.multiplier);
    if (!isFinite(multiplier) || multiplier <= 0) {
      multiplier = probability > 0 ? S.roundBal(0.93 / probability) : 1.86;
    }
    var payout = parseFloat(body.payout);
    if (!isFinite(payout) || payout <= 0) payout = S.roundBal(bet * multiplier);

    S.bumpNonce();
    S.walletMove(-bet);
    S.trackWager(bet);
    S.pushTx("play", -bet, "dice");
    var events = [{ _id: S.uuid(), amount: -bet, currency: "FLIPCOINS" }];
    if (isWin) {
      S.walletMove(payout);
      S.pushTx("win", payout, "dice");
      events.push({ _id: S.uuid(), amount: payout, currency: "FLIPCOINS" });
    }
    S.injectLiveFeed("dice", isWin ? "win" : "lose", bet, isWin ? payout : 0);

    var gid = S.uuid();
    S.ensureGameLedger("dice").unshift(
      diceHistRow("dice", bet, isWin ? payout : 0, isWin, { roll: roll, ranges: ranges, win: isWin })
    );
    S.saveSession();
    return {
      id: gid,
      uuid: gid,
      userId: S.wallet.profileId,
      created: Date.now(),
      bet: bet,
      ranges: ranges,
      roll: roll,
      serverSeed: S.hexN(128),
      serverHash: S.hexN(64),
      nonce: S.wallet.nonce,
      clientSeed: S.wallet.clientSeed,
      probability: probability,
      multiplier: multiplier,
      payout: payout,
      isWin: isWin,
      win: isWin,
      gameEvents: events,
      currency: "FLIPCOINS",
      wallet: S.wallet.flip,
    };
  };
})(window.BfSim);
