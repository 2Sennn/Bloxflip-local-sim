(function (S) {
  if (!S || S.off || S.skip) return;

  S.apiPath = function (rawUrl) {
    if (!rawUrl) return "";
    try {
      var u = rawUrl.indexOf("http") === 0 ? new URL(rawUrl) : new URL(rawUrl, location.origin);
      return u.pathname.replace(/\/+$/, "") || "/";
    } catch (e) {
      return "";
    }
  };

  S.reqUrl = function (input) {
    if (typeof input === "string") return input;
    if (input && typeof input === "object" && input.url) return input.url;
    return "";
  };

  S.reqMethod = function (input, init) {
    if (init && init.method) return String(init.method).toUpperCase();
    if (input && input.method) return String(input.method).toUpperCase();
    return "GET";
  };

  S.parseJsonBody = function (raw) {
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  S.reqBody = function (init) {
    if (!init || init.body == null) return null;
    return S.parseJsonBody(init.body);
  };

  S.normGamePath = function (path) {
    var p = (path || "").replace(/\/+$/, "");
    if (p.indexOf("/api/games/") === 0) p = p.slice(4);
    return p;
  };

  S.parseGameRoute = function (path) {
    var p = S.normGamePath(path);
    var m = p.match(/^\/games\/([^/]+)(?:\/([^/?]+))?/);
    if (!m) return null;
    return { mode: m[1].toLowerCase(), endpoint: (m[2] || "").toLowerCase(), path: p };
  };

  S.isPfEndpoint = function (ep) {
    return /^(fair|verify|seed|client-seed|server-seed|nonce|provably)/.test(ep || "");
  };

  S.pathIs = function (method, path, suffix) {
    var p = S.normGamePath(path);
    return method === suffix.m && (p === suffix.p || p.endsWith(suffix.p));
  };

  S.absUrl = function (url) {
    if (!url) return location.origin + "/api";
    if (url.indexOf("http") === 0) return url;
    return location.origin + (url.charAt(0) === "/" ? url : "/" + url);
  };

  S.parseHistQuery = function (url) {
    try {
      var u = url.indexOf("http") === 0 ? new URL(url) : new URL(url, location.origin);
      return {
        size: parseInt(u.searchParams.get("size") || "50", 10) || 50,
        page: parseInt(u.searchParams.get("page") || "0", 10) || 0,
      };
    } catch (e) {
      return { size: 50, page: 0 };
    }
  };

  S.isHistoryPath = function (path) {
    return /^\/games\/[^/]+\/history/.test(S.normGamePath(path));
  };

  S.isTxPath = function (path) {
    if (!path) return false;
    var low = path.toLowerCase();
    return (
      low.indexOf("/transaction") >= 0 ||
      low.indexOf("/wallet/history") >= 0 ||
      low.indexOf("/wallet/transactions") >= 0 ||
      low.indexOf("/user/history") >= 0 ||
      low.indexOf("/games/events") >= 0 ||
      low.indexOf("/activity") >= 0
    );
  };

  S.isUserPath = function (path) {
    var p = String(path || "").replace(/\/+$/, "");
    return p === "/api/user" || p === "/user";
  };

  S.isOverlayPath = function (path) {
    var p = String(path || "").toLowerCase().replace(/\/+$/, "");
    return (
      /\/raffles(\/me)?$/.test(p) ||
      /\/race(\/me)?$/.test(p) ||
      /\/rewards\/levels$/.test(p) ||
      /\/rain-event/.test(p) ||
      /\/live-feed/.test(p) ||
      /\/chat\/state$/.test(p)
    );
  };

  S.simDelayMs = function (path) {
    var p = String(path || "").toLowerCase();
    if (/mines|towers|dice/.test(p)) return 0;
    return 15 + Math.random() * 25;
  };
})(window.BfSim);
