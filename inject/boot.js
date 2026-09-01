(function (S) {
  if (!S || S.off || S.skip) return;

  try {
    document.documentElement.setAttribute("data-lxs", S.version);
  } catch (e) {
    // documentElement is sometimes null at document_start
  }

  var bootSession = S.loadSession();
  if (bootSession) S.applySessionConfig(bootSession);

  window.__lxsApplyCfg = function (cfg) {
    S.applySessionConfig(cfg);
  };

  if (S.pendingSession) {
    S.applySessionConfig(S.pendingSession);
    S.pendingSession = null;
  }

  S._rainTimer = setInterval(S.tickRain, 400);

  window.__lxs = {
    ledger: function () {
      return S.ledger;
    },
    mines: function () {
      return S.mines;
    },
    tower: function () {
      return S.tower;
    },
    rain: function () {
      return S.rain;
    },
  };

  S.dbg("hook installed at document_start");
  console.log("[LXS] " + S.version);
})(window.BfSim);
