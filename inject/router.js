(function (S) {
  if (!S || S.off || S.skip) return;

  S.mergeHistoryPayload = function (simRows, serverJson, url) {
    var q = S.parseHistQuery(url);
    var out = serverJson || { success: true, data: [] };
    var real = out.data || [];
    var combined;

    if (q.page === 0) {
      combined = simRows.concat(real);
    } else {
      combined = real;
    }

    out.data = combined.slice(0, q.size);
    if (out.total != null) out.total = (out.total || 0) + simRows.length;
    if (out.count != null) out.count = (out.count || 0) + simRows.length;
    if (out.totalCount != null) out.totalCount = (out.totalCount || 0) + simRows.length;
    out.page = q.page;
    out.size = q.size;
    var totalItems = simRows.length + (out.total != null ? out.total - simRows.length : real.length * (q.page + 2));
    out.hasNext = (q.page + 1) * q.size < totalItems;
    out.hasMore = out.hasNext;
    return out;
  };

  function historyPage(rows, q) {
    var start = q.page * q.size;
    return {
      success: true,
      data: rows.slice(start, start + q.size),
      page: q.page,
      size: q.size,
      total: rows.length,
      hasNext: start + q.size < rows.length,
      hasMore: start + q.size < rows.length,
    };
  }

  S.simHistory = function (method, path, url) {
    if (method !== "GET") return null;
    var p = S.normGamePath(path);
    var q = S.parseHistQuery(url);

    if (p.indexOf("/games/mines/history") === 0) return historyPage(S.ledger.mines, q);
    if (p.indexOf("/games/towers/history") === 0) return historyPage(S.ledger.towers, q);
    var gMatch = p.match(/^\/games\/([^/]+)\/history/);
    if (gMatch) return historyPage(S.ensureGameLedger(gMatch[1].toLowerCase()), q);
    return null;
  };

  S.runSim = function (method, path, body) {
    var social = S.simSocial(method, path, body);
    if (social) return social;

    var route = S.parseGameRoute(path);
    if (!route) return null;
    if (route.endpoint === "history" || S.isPfEndpoint(route.endpoint)) return null;

    if (route.mode === "mines") return S.simMines(method, path, body);
    if (route.mode === "towers") return S.simTowers(method, path, body);
    if (route.mode === "dice") return S.simDice(method, path, body);
    return null;
  };

  S.classifyRequest = function (method, path, url, body) {
    var payload = null;
    try {
      payload = S.runSim(method, path, body);
    } catch (e) {
      // A thrown handler must not take down page fetch; the request goes to Bloxflip instead.
      S.dbg("sim-throw", method, path, String(e && e.message));
    }
    if (payload) return { kind: "simulate", payload: payload };

    if (method === "GET" && S.isHistoryPath(path)) {
      var simH = S.simHistory(method, path, url);
      return { kind: "history", simH: simH, simRows: (simH && simH.data) || [] };
    }
    if (method === "GET" && S.isTxPath(path)) return { kind: "transactions" };
    if (method === "GET" && S.isUserPath(path)) return { kind: "user" };
    if (method === "GET" && S.isOverlayPath(path)) return { kind: "overlay" };
    return { kind: "passthrough" };
  };
})(window.BfSim);
