(function (S) {
  if (!S || S.off || S.skip) return;

  function jsonBody(obj) {
    return JSON.stringify(obj);
  }

  function makeResp(obj, status) {
    status = status || 200;
    return new Response(jsonBody(obj), {
      status: status,
      statusText: status === 200 ? "OK" : "Error",
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fire a real XHR then abort it so DevTools still lists the bloxflip.com URL.
  function netGhost(method, url, bodyObj) {
    var open = netGhost._open;
    var send = netGhost._send;
    if (!open || !send) return;
    try {
      var abs = S.absUrl(url);
      var g = new XMLHttpRequest();
      open.call(g, method, abs, true);
      try {
        g.setRequestHeader("Content-Type", "application/json");
      } catch (e0) {
        // XHR wrappers sometimes reject setRequestHeader
      }
      send.call(g, bodyObj && method !== "GET" ? JSON.stringify(bodyObj) : null);
      setTimeout(function () {
        g.abort();
      }, 0);
    } catch (e2) {
      // ghost request is cosmetic; a failure must not block the simulated response
    }
  }

  function deliverSim(method, url, bodyObj, payload) {
    netGhost(method, url, bodyObj);
    var st = payload._status || 200;
    delete payload._status;
    return new Promise(function (resolve) {
      var wait = S.simDelayMs(url);
      if (wait <= 0) {
        resolve(makeResp(payload, st));
        return;
      }
      setTimeout(function () {
        resolve(makeResp(payload, st));
      }, wait);
    });
  }

  function finishXhr(xhr, status, text) {
    function set(prop, val) {
      try {
        Object.defineProperty(xhr, prop, { configurable: true, writable: true, value: val });
      } catch (e) {
        // native XHR responseText/status are often getter-only
        xhr[prop] = val;
      }
    }

    if (!xhr._lxsHdr) {
      xhr._lxsHdr = true;
      xhr.getResponseHeader = function (name) {
        if (String(name).toLowerCase() === "content-type") return "application/json";
        return null;
      };
      xhr.getAllResponseHeaders = function () {
        return "content-type: application/json\r\n";
      };
    }

    var steps = [2, 3, 4],
      i = 0;
    var instant = S.simDelayMs(xhr._lxsUrl) <= 0;

    function step() {
      if (i >= steps.length) {
        if (xhr.onload) xhr.onload();
        if (xhr.onloadend) xhr.onloadend();
        try {
          xhr.dispatchEvent(new Event("load"));
          xhr.dispatchEvent(new Event("loadend"));
        } catch (e2) {
          // some XHR instances are not EventTargets; onload already ran
        }
        return;
      }
      set("readyState", steps[i]);
      set("status", status);
      set("statusText", status === 200 ? "OK" : "Error");
      set("responseText", text);
      set("response", text);
      if (xhr.onreadystatechange) xhr.onreadystatechange();
      try {
        xhr.dispatchEvent(new Event("readystatechange"));
      } catch (e3) {
        // same: keep walking readyState even if dispatchEvent is missing
      }
      i += 1;
      if (instant) step();
      else setTimeout(step, 0);
    }

    if (instant) step();
    else setTimeout(step, 0);
  }

  var _fetch = window.fetch.bind(window);
  netGhost._open = XMLHttpRequest.prototype.open;
  netGhost._send = XMLHttpRequest.prototype.send;

  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;

  function nativeJson(url) {
    // XHR hybrid GETs read JSON through fetch so we don't fight the in-flight XHR instance.
    return _fetch(S.absUrl(url), { credentials: "include" }).then(function (r) {
      return r.json();
    });
  }

  window.fetch = function (input, init) {
    init = init || {};
    var url = S.reqUrl(input);
    var method = S.reqMethod(input, init);
    var path = S.apiPath(url);

    function afterSim(body) {
      var classified = S.classifyRequest(method, path, url, body);

      if (classified.kind === "simulate") {
        S.dbg("fetch", method, path);
        return deliverSim(method, url, body, classified.payload);
      }

      if (classified.kind === "history") {
        return _fetch(input, init)
          .then(function (resp) {
            return resp.json().then(function (j) {
              return makeResp(S.mergeHistoryPayload(classified.simRows, j, url), resp.status);
            });
          })
          .catch(function () {
            // network or JSON parse failure: still show local history rows
            return makeResp(classified.simH || { success: true, data: classified.simRows });
          });
      }

      if (classified.kind === "transactions") {
        return _fetch(input, init)
          .then(function (resp) {
            return resp.json().then(function (j) {
              return makeResp(S.mergeTxPayload(j), resp.status);
            });
          })
          .catch(function () {
            return makeResp(S.mergeTxPayload(null));
          });
      }

      if (classified.kind === "user") {
        return _fetch(input, init).then(function (resp) {
          return resp.json().then(function (j) {
            S.ingestUser(j);
            return makeResp(S.applyUserPatch(j), resp.status);
          });
        });
      }

      if (classified.kind === "overlay") {
        return _fetch(input, init)
          .then(function (resp) {
            return resp.json().then(function (j) {
              return makeResp(S.applyOverlay(path, j), resp.status);
            });
          })
          .catch(function () {
            if (/\/rain-event/.test(path) && S.rain.active && S.rain.fake) return makeResp(S.rainPayload());
            // first body wasn't JSON; replay instead of synthesizing overlay data
            return _fetch(input, init);
          });
      }

      return _fetch(input, init);
    }

    var body = S.reqBody(init);
    var needsBody = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    // Request objects often leave init.body empty; the body lives on the Request itself.
    if (needsBody && !body && typeof Request !== "undefined" && input instanceof Request) {
      return input
        .clone()
        .text()
        .then(function (txt) {
          return afterSim(S.parseJsonBody(txt));
        });
    }

    return afterSim(body);
  };

  XMLHttpRequest.prototype.open = function (method, url) {
    this._lxsMethod = method;
    this._lxsUrl = url;
    return _open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    var xhr = this;
    var method = (xhr._lxsMethod || "GET").toUpperCase();
    var path = S.apiPath(xhr._lxsUrl || "");
    var parsed = S.parseJsonBody(body);
    var classified = S.classifyRequest(method, path, xhr._lxsUrl || "", parsed);

    if (classified.kind === "simulate") {
      netGhost(method, xhr._lxsUrl || "", parsed);
      var simCode = classified.payload._status || 200;
      delete classified.payload._status;
      S.dbg("xhr", method, path);
      finishXhr(xhr, simCode, jsonBody(classified.payload));
      return;
    }

    if (classified.kind === "history") {
      var histUrl = xhr._lxsUrl || "";
      nativeJson(histUrl)
        .then(function (j) {
          finishXhr(xhr, 200, jsonBody(S.mergeHistoryPayload(classified.simRows, j, histUrl)));
        })
        .catch(function () {
          finishXhr(xhr, 200, jsonBody(classified.simH || { success: true, data: classified.simRows }));
        });
      return;
    }

    if (classified.kind === "transactions") {
      nativeJson(xhr._lxsUrl || "")
        .then(function (j) {
          finishXhr(xhr, 200, jsonBody(S.mergeTxPayload(j)));
        })
        .catch(function () {
          finishXhr(xhr, 200, jsonBody(S.mergeTxPayload(null)));
        });
      return;
    }

    if (classified.kind === "overlay") {
      nativeJson(xhr._lxsUrl || "")
        .then(function (j) {
          finishXhr(xhr, 200, jsonBody(S.applyOverlay(path, j)));
        })
        .catch(function () {
          var fallback = { success: true };
          if (/\/rain-event/.test(path) && S.rain.active && S.rain.fake) {
            fallback = S.rainPayload();
          }
          // unlike fetch, this XHR is already hijacked so we cannot replay it
          finishXhr(xhr, 200, jsonBody(fallback));
        });
      return;
    }

    // User GETs still use the real XHR so React sees a normal round-trip; we patch the body on load.
    if (classified.kind === "user") {
      xhr.addEventListener(
        "load",
        function () {
          try {
            var j = JSON.parse(xhr.responseText);
            S.ingestUser(j);
            S.applyUserPatch(j);
            var out = jsonBody(j);
            Object.defineProperty(xhr, "responseText", { configurable: true, value: out });
            Object.defineProperty(xhr, "response", { configurable: true, value: out });
          } catch (e2) {
            // non-JSON user payloads stay unpatched
          }
        },
        { once: true }
      );
    }

    return _send.apply(this, arguments);
  };
})(window.BfSim);
