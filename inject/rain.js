(function (S) {
  if (!S || S.off || S.skip) return;

  S.rain = {
    fake: false,
    active: false,
    id: null,
    prize: 0,
    host: "Bloxflip",
    created: 0,
    endsAt: 0,
    joined: false,
    players: 0,
    paid: false,
    dripTarget: 0,
    dripAt: 0,
  };

  S.rainPayload = function () {
    var rain = S.rain;
    var now = Date.now();
    var left = Math.max(0, Math.floor((rain.endsAt - now) / 1000));
    var host = rain.host;
    var core = {
      id: rain.id,
      uuid: rain.id,
      rainId: rain.id,
      prize: rain.prize,
      prizeAmount: rain.prize,
      amount: rain.prize,
      currency: "FLIPCOINS",
      players: rain.players,
      playerCount: rain.players,
      timeLeft: left,
      timer: left,
      endsAt: rain.endsAt,
      ending: rain.endsAt,
      created: rain.created,
      host: host,
      hostUsername: host,
      username: host,
      active: rain.active,
      joined: rain.joined,
      state: rain.active ? "active" : "ended",
    };
    return Object.assign(
      {
        success: true,
        rain: core,
        event: core,
      },
      core
    );
  };

  S.pushRainWs = function () {
    var data = S.rainPayload();
    var tpl = S.wsHint.rainTpl;
    if (tpl && typeof tpl === "object") {
      data = Object.assign({}, tpl, data);
    }
    var channels = S.wsHint.rainCh.length
      ? S.wsHint.rainCh.slice()
      : ["chat:rain-state-changed", "rain", "chat:rain"];
    if (channels.indexOf("chat:rain-state-changed") < 0) channels.push("chat:rain-state-changed");
    var i;
    for (i = 0; i < channels.length; i++) {
      S.broadcastSock({ push: { channel: channels[i], pub: { data: data } } });
    }
  };

  S.startCommandRain = function (prize) {
    prize = S.roundBal(Math.abs(parseFloat(prize) || 0));
    if (!(prize > 0)) return;
    if (S.rain.active && S.rain.fake) return;
    var rain = S.rain;
    rain.fake = true;
    rain.active = true;
    rain.paid = false;
    rain.joined = true;
    rain.id = S.uuid();
    rain.prize = prize;
    rain.host = S.wallet.username || "Player";
    rain.created = Date.now();
    rain.endsAt = Date.now() + 45000;
    rain.players = 1;
    var pct = 0.7 + Math.random() * 0.2;
    var online = S.chatOnline > 0 ? S.chatOnline : 500;
    rain.dripTarget = Math.max(2, Math.round(online * pct));
    rain.dripAt = Date.now() + 300 + Math.random() * 700;
    S.saveSession();
    S.pushRainWs();
  };

  S.dripRain = function () {
    var rain = S.rain;
    if (!rain.active || !rain.fake) return;
    if (rain.players >= rain.dripTarget) return;
    var now = Date.now();
    if (now < rain.dripAt) return;
    var leftMs = Math.max(500, rain.endsAt - now);
    var leftPeople = rain.dripTarget - rain.players;
    var steps = Math.max(2, Math.floor(leftMs / 700));
    var burst = Math.max(1, Math.ceil(leftPeople / steps));
    if (burst > 14) burst = 14;
    rain.players += burst;
    if (rain.players > rain.dripTarget) rain.players = rain.dripTarget;
    rain.dripAt = now + 400 + Math.random() * 800;
    S.pushRainWs();
    S.saveSession();
  };

  S.rainPrizeFromText = function (raw) {
    var m = String(raw || "").match(/\.rain\s+([0-9]+(?:\.[0-9]+)?)/i);
    return m ? parseFloat(m[1]) : 0;
  };

  S.tryRainCommand = function (raw) {
    var prize = S.rainPrizeFromText(raw);
    if (!(prize > 0)) {
      // WS/chat payloads are often not JSON; sniff .rain out of a parsed object when they are.
      try {
        var parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === "object") prize = S.rainPrizeFromText(JSON.stringify(parsed));
      } catch (e) {}
    }
    if (!(prize > 0)) return false;
    S.startCommandRain(prize);
    return true;
  };

  S.endRain = function () {
    var rain = S.rain;
    if (rain.joined && !rain.paid && rain.fake) {
      var share = S.roundBal(rain.prize / Math.max(rain.players, 1));
      if (share > 0) {
        S.walletMove(share);
        S.pushTx("win", share, "rain");
      }
      rain.paid = true;
    }
    rain.active = false;
    rain.fake = false;
    rain.endsAt = Date.now();
    rain.players = rain.players || 0;
    S.pushRainWs();
    S.saveSession();
  };

  S.simSocial = function (method, path, body) {
    var p = String(path || "").replace(/\/+$/, "");
    if (method === "POST" && body) {
      var prize = S.rainPrizeFromText(body.text || body.message || body.content || body.msg || "");
      if (!prize) prize = S.rainPrizeFromText(JSON.stringify(body));
      if (prize > 0 && (/chat/i.test(p) || body.text || body.message || body.content)) {
        S.startCommandRain(prize);
        return { success: true };
      }
    }
    if (method === "POST" && /\/chat\/rain\/participate$/.test(p)) {
      if (!S.rain.active || !S.rain.fake) return null;
      if (!S.rain.joined) {
        S.rain.joined = true;
        S.rain.players += 1;
      }
      S.pushRainWs();
      S.saveSession();
      return { success: true, joined: true, rainId: S.rain.id, id: S.rain.id };
    }
    return null;
  };

  S.tickRain = function () {
    if (S.rain.active && S.rain.fake) {
      if (Date.now() >= S.rain.endsAt) S.endRain();
      else S.dripRain();
    }
  };
})(window.BfSim);
