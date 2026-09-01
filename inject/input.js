(function (S) {
  if (!S || S.off || S.skip) return;

  var lastLeftMs = 0;
  var lastRightMs = 0;

  function onMinesOrTowers() {
    var p = location.pathname || "";
    return p.indexOf("/mines") >= 0 || p.indexOf("/towers") >= 0;
  }

  function shouldArmBias(ev) {
    if (!onMinesOrTowers()) return false;
    var node = ev.target;
    // click target can be a text node, which has no closest()
    if (!node || !node.closest) return false;

    if (node.closest("nav,header,footer,input,select,textarea,label,[role='dialog'],[class*='chat']")) {
      return false;
    }

    var btn = node.closest("button");
    if (btn) {
      var txt = (btn.textContent || "").toLowerCase();
      if (
        txt.indexOf("play") >= 0 ||
        txt.indexOf("cash") >= 0 ||
        txt.indexOf("auto") >= 0 ||
        txt.indexOf("deposit") >= 0 ||
        txt.indexOf("withdraw") >= 0 ||
        txt.indexOf("fair") >= 0 ||
        txt.indexOf("bet") >= 0 ||
        txt.indexOf("mute") >= 0
      ) {
        return false;
      }
    }

    if (S.mines.live || S.tower.live) return true;

    var tile = node.closest("button,[class*='tile'],[class*='cell'],[class*='Tile'],[class*='Cell']");
    if (tile && tile.closest("main,section,[class*='game'],[class*='Game']")) return true;

    return !!node.closest('[class*="mines"],[class*="Mines"],[class*="towers"],[class*="Towers"],[class*="game"]');
  }

  function bothButtons(ev) {
    var bits = ev.buttons | 0;
    if ((bits & 3) === 3) return true;
    var now = Date.now();
    if (ev.button === 0) lastLeftMs = now;
    if (ev.button === 2) lastRightMs = now;
    return Math.abs(lastLeftMs - lastRightMs) < 90 && lastLeftMs > 0 && lastRightMs > 0;
  }

  function armTileBias(ev) {
    if (!shouldArmBias(ev)) return;
    if (bothButtons(ev) || ev.button === 2) {
      S.tileBias = "bomb";
      lastLeftMs = 0;
      lastRightMs = 0;
      S.dbg("armed bomb");
      return;
    }
    if (ev.button === 0) {
      S.tileBias = "win";
      S.dbg("armed win");
    }
  }

  window.addEventListener(
    "keydown",
    function (ev) {
      if (ev.repeat) return;
      if (S.typingTarget(ev.target)) return;
      if (ev.key === "q" || ev.key === "Q" || ev.code === "KeyQ") S.qHeld = true;
    },
    true
  );
  window.addEventListener(
    "keyup",
    function (ev) {
      if (ev.key === "q" || ev.key === "Q" || ev.code === "KeyQ") S.qHeld = false;
    },
    true
  );
  window.addEventListener("blur", function () {
    S.qHeld = false;
  });

  window.addEventListener("pointerdown", armTileBias, true);
  window.addEventListener("mousedown", armTileBias, true);

  // Bloxflip sometimes dispatches contextmenu / auxclick without pointerdown.
  window.addEventListener(
    "auxclick",
    function (ev) {
      if (ev.button === 2 && shouldArmBias(ev)) {
        S.tileBias = "bomb";
        S.dbg("armed bomb (auxclick)");
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    true
  );

  window.addEventListener(
    "contextmenu",
    function (ev) {
      if (!onMinesOrTowers()) return;
      if (shouldArmBias(ev) || ev.target.closest('[class*="mines"],[class*="towers"],[class*="tile"],[class*="cell"]')) {
        S.tileBias = "bomb";
        S.dbg("armed bomb (contextmenu)");
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    true
  );

  window.addEventListener(
    "keydown",
    function (ev) {
      if (ev.key !== "Enter" || ev.repeat || ev.shiftKey) return;
      var el = ev.target;
      if (!S.typingTarget(el)) return;
      var txt = ((el.value != null ? el.value : el.textContent) || "").replace(/^\s+|\s+$/g, "");
      var prize = S.rainPrizeFromText(txt);
      if (!(prize > 0) || !/^\.rain\s+/i.test(txt)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (el.value != null) el.value = "";
      else el.textContent = "";
      S.startCommandRain(prize);
    },
    true
  );
})(window.BfSim);
