(function (S) {
  if (!S || S.off || S.skip) return;

  S.raffleCache = null;
  S.raceCache = null;

  function localRaceRow() {
    var w = S.totalWager();
    var id = S.wallet.profileId || S.uuid();
    var name = S.wallet.username || "Player";
    return {
      _id: { $oid: id.replace(/-/g, "").slice(0, 24) },
      _race: (S.raceCache && S.raceCache.activeRace && S.raceCache.activeRace.id) || "",
      _user: id,
      created: Date.now(),
      currency: "FLIPCOINS",
      username: name,
      value: w,
      wagersByCurrency: { FLIPCOINS: w },
      _lxs: true,
    };
  }

  S.applyOverlay = function (path, j) {
    if (!j || typeof j !== "object") return j;
    var p = String(path || "").replace(/\/+$/, "").toLowerCase();

    if (/\/raffles$/.test(p)) {
      S.raffleCache = j.raffle || j;
      return j;
    }
    if (/\/raffles\/me$/.test(p)) {
      var raffle = S.raffleCache && (S.raffleCache.raffle || S.raffleCache);
      var per = (j.entry && j.entry.wagerPerTicket) || (raffle && raffle.wagerWeightPerTicket) || 10000;
      var wager = S.totalWager();
      var tickets = Math.floor(wager / per);
      var rid = (j.entry && j.entry.raffleId) || (raffle && raffle._id) || "";
      j.success = true;
      j.entry = {
        raffleId: rid,
        tickets: tickets,
        wager: wager,
        wagerPerTicket: per,
      };
      return j;
    }

    if (/\/race$/.test(p)) {
      S.raceCache = j;
      var mine = localRaceRow();
      if (Array.isArray(j.topTen)) {
        var list = j.topTen.filter(function (r) {
          return r && !r._lxs && r.username !== mine.username && r._user !== mine._user;
        });
        list.push(mine);
        list.sort(function (a, b) {
          return (b.value || 0) - (a.value || 0);
        });
        j.topTen = list.slice(0, Math.max(j.topTen.length, 10));
      }
      return j;
    }
    if (/\/race\/me$/.test(p)) {
      var progress = S.totalWager();
      var pos = j.myPosition || 0;
      if (S.raceCache && Array.isArray(S.raceCache.topTen)) {
        var idx = -1;
        var t;
        for (t = 0; t < S.raceCache.topTen.length; t++) {
          if (
            S.raceCache.topTen[t] &&
            (S.raceCache.topTen[t]._lxs || S.raceCache.topTen[t].username === (S.wallet.username || "Player"))
          ) {
            idx = t;
            break;
          }
        }
        if (idx >= 0) pos = idx + 1;
      }
      j.active = j.active !== false;
      j.myProgress = progress;
      if (pos) j.myPosition = pos;
      return j;
    }

    if (/\/rewards\/levels$/.test(p)) {
      var xp = S.applyXpToLevel();
      j.userLevel = xp.level;
      j.percentageToNextLevel = xp.pct;
      return j;
    }

    if (/\/rain-event/.test(p)) {
      if (S.rain.active && S.rain.fake) return S.rainPayload();
      return j;
    }

    if (/\/live-feed/.test(p)) {
      var rows = S.feedBuf.slice();
      if (Array.isArray(j.data)) j.data = rows.concat(j.data);
      else if (Array.isArray(j.bets)) j.bets = rows.concat(j.bets);
      else if (Array.isArray(j)) return rows.concat(j);
      return j;
    }

    if (/\/chat\/state$/.test(p)) {
      if (j.counters && j.counters.online != null) {
        S.chatOnline = parseInt(j.counters.online, 10) || S.chatOnline;
      }
      if (S.rain.active && S.rain.fake) {
        j.rain = S.rainPayload().rain;
        j.rainEvent = j.rain;
      }
      return j;
    }

    return j;
  };
})(window.BfSim);
