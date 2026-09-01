(function (S) {
  if (!S || S.off || S.skip) return;

  var NativeWS = window.WebSocket;
  var wsPool = [];

  S.wsHint = {
    rainCh: [],
    feedCh: [],
    walletCh: [],
    rainTpl: null,
    feedTpl: null,
  };

  function isBfWs(url) {
    var u = String(url || "").toLowerCase();
    return (
      u.indexOf("realtime.bloxflip.com") >= 0 ||
      u.indexOf("bloxflip") >= 0 ||
      u.indexOf("blox.land") >= 0 ||
      u.indexOf("socket.io") >= 0
    );
  }

  S.broadcastSock = function (packet) {
    var i,
      ws,
      data = typeof packet === "string" ? packet : JSON.stringify(packet);
    for (i = 0; i < wsPool.length; i++) {
      ws = wsPool[i];
      if (ws.readyState === 1) {
        try {
          // Fake MessageEvent on a native socket is unsupported; some wrappers throw.
          ws.dispatchEvent(new MessageEvent("message", { data: data }));
        } catch (e) {}
      }
    }
  };

  function rememberChannel(list, ch) {
    if (!ch || list.indexOf(ch) >= 0) return;
    list.push(ch);
  }

  function learnWs(raw) {
    var s0 = String(raw || "");
    var j = null;
    if (s0.charAt(0) === "{" || s0.charAt(0) === "[") {
      try {
        j = JSON.parse(s0);
      } catch (e) {
        j = null;
      }
    }
    if (j && j.push && j.push.channel) {
      var ch = String(j.push.channel);
      var data = j.push.pub && j.push.pub.data;
      if (/feed/i.test(ch)) {
        rememberChannel(S.wsHint.feedCh, ch);
        if (data && typeof data === "object") S.wsHint.feedTpl = data;
      }
      if (/rain/i.test(ch)) {
        rememberChannel(S.wsHint.rainCh, ch);
        if (data && typeof data === "object") S.wsHint.rainTpl = data;
      }
      if (/wallet|balance/i.test(ch)) {
        rememberChannel(S.wsHint.walletCh, ch);
      }
    }
  }

  function learnWsSend(raw) {
    try {
      var s0 = String(raw || "");
      if (s0.charAt(0) !== "{") return;
      var j = JSON.parse(s0);
      var ch = (j.subscribe && j.subscribe.channel) || (j.channel && typeof j.channel === "string" ? j.channel : null);
      if (!ch) return;
      if (/feed/i.test(ch)) rememberChannel(S.wsHint.feedCh, ch);
      if (/rain/i.test(ch)) rememberChannel(S.wsHint.rainCh, ch);
      if (/wallet|balance/i.test(ch)) rememberChannel(S.wsHint.walletCh, ch);
    } catch (e) {
      // outbound frames are often socket.io / binary, not JSON subscribe messages
    }
  }

  S.injectWalletSock = function (delta) {
    var abs = S.wallet.flip;
    var tx = {
      id: S.uuid(),
      _id: S.uuid(),
      user: S.wallet.profileId,
      amount: S.roundBal(delta),
      beforeBalance: S.roundBal(abs - delta),
      reason: delta >= 0 ? "Game Win" : "Game Play",
      extraData: {},
      currency: "FLIPCOINS",
      created: Date.now(),
      announceDelay: 0,
    };
    var data = {
      wallet: abs,
      balance: abs,
      newBalance: abs,
      delta: S.roundBal(delta),
      balances: { FLIPCOINS: abs },
      playTransactions: delta < 0 ? [tx] : [],
      winTransactions: delta > 0 ? [tx] : [],
    };
    var channels = S.wsHint.walletCh.length
      ? S.wsHint.walletCh.slice()
      : ["wallet", "wallet:update", "user:wallet", "private:wallet"];
    if (channels.indexOf("wallet") < 0) channels.push("wallet");
    var i;
    for (i = 0; i < channels.length; i++) {
      S.broadcastSock({ push: { channel: channels[i], pub: { data: data } } });
    }
    S.broadcastSock('42["update-wallet",' + JSON.stringify(data) + "]");
  };

  function pushFeedBet(gamemode, bet, multiplier, winnings) {
    var won = winnings > 0;
    var data = {
      uuid: S.uuid(),
      gamemode: gamemode,
      username: S.wallet.username || "Player",
      userId: S.wallet.profileId || S.uuid(),
      bet: S.roundBal(bet),
      multiplier: multiplier,
      winnings: S.roundBal(winnings),
      payout: S.roundBal(winnings),
      isWin: won,
      win: won,
      created: Date.now(),
      currency: "FLIPCOINS",
      animationDelay: 0,
      extraData: {},
      identifier: S.uuid(),
      high: false,
      lucky: false,
    };
    S.feedBuf.unshift(data);
    if (S.feedBuf.length > 40) S.feedBuf.pop();
    var channels = S.wsHint.feedCh.length ? S.wsHint.feedCh.slice() : ["feed:new-bet"];
    if (channels.indexOf("feed:new-bet") < 0) channels.push("feed:new-bet");
    if (channels.indexOf("public:feed:new-bet") < 0) channels.push("public:feed:new-bet");
    var i, ch;
    for (i = 0; i < channels.length; i++) {
      ch = channels[i];
      S.broadcastSock({ push: { channel: ch, pub: { data: data } } });
    }
  }

  S.injectLiveFeed = function (gameKey, phase, bet, winAmt) {
    var won = winAmt > 0;
    var mult = 0;
    if (phase === "play") {
      pushFeedBet(gameKey, bet, 0, 0);
      return;
    }
    if (bet > 0 && won) mult = S.roundBal(winAmt / bet);
    pushFeedBet(gameKey, bet, mult, won ? winAmt : 0);
  };

  if (!NativeWS) return;

  window.WebSocket = function (url, protocols) {
    var ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
    if (isBfWs(url)) {
      wsPool.push(ws);
      try {
        var origSend = ws.send.bind(ws);
        ws.send = function (data) {
          if (S.tryRainCommand(data)) return;
          learnWsSend(data);
          return origSend(data);
        };
      } catch (eSend) {
        // some WS polyfills expose a non-writable send
      }
      ws.addEventListener("message", function (ev) {
        learnWs(ev.data);
      });
      ws.addEventListener("open", function () {
        setTimeout(function () {
          var i;
          for (i = Math.min(S.feedBuf.length, 20) - 1; i >= 0; i--) {
            S.broadcastSock({ push: { channel: "feed:new-bet", pub: { data: S.feedBuf[i] } } });
          }
          if (S.rain.active && S.rain.fake) S.pushRainWs();
        }, 400);
      });
      ws.addEventListener("close", function () {
        var ix = wsPool.indexOf(ws);
        if (ix >= 0) wsPool.splice(ix, 1);
      });
    }
    return ws;
  };
  window.WebSocket.prototype = NativeWS.prototype;
  window.WebSocket.CONNECTING = NativeWS.CONNECTING;
  window.WebSocket.OPEN = NativeWS.OPEN;
  window.WebSocket.CLOSING = NativeWS.CLOSING;
  window.WebSocket.CLOSED = NativeWS.CLOSED;
})(window.BfSim);
