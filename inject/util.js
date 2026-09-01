(function (S) {
  if (!S || S.off || S.skip) return;

  S.dbg = function () {
    if (!S.dbgOn) return;
    console.log.apply(console, ["[lxs]"].concat([].slice.call(arguments)));
  };

  S.uuid = function () {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  };

  S.roundBal = function (n) {
    return Math.round(n * 1e12) / 1e12;
  };

  S.hexN = function (n) {
    var s = "",
      i;
    for (i = 0; i < n; i++) s += ((Math.random() * 16) | 0).toString(16);
    return s;
  };

  S.copyFields = function (target, src) {
    if (!target || !src || typeof src !== "object") return;
    var k;
    for (k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
  };

  S.typingTarget = function (el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return !!el.isContentEditable;
  };
})(window.BfSim);
