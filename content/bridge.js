// isolated world. push session into the page.
(function () {
  var SESSION_KEY = "lxs_session";

  function syncSession(session) {
    if (!session) return;
    try {
      var existing = localStorage.getItem(SESSION_KEY);
      if (existing && !session.fresh) {
        var loc = JSON.parse(existing);
        if (loc && loc.touched) {
          window.postMessage({ source: "lxs-bridge", type: "LXS_SESSION", session: loc }, "*");
          return;
        }
      }
    } catch (e) {
      // corrupt localStorage or blocked storage; fall through and write the popup session
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e2) {
      // quota / privacy mode; still postMessage so the page can apply the session
    }
    window.postMessage({ source: "lxs-bridge", type: "LXS_SESSION", session: session }, "*");
  }

  chrome.storage.local.get("lxsSession", function (r) {
    if (r.lxsSession) syncSession(r.lxsSession);
  });

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === "LXS_SESSION" && msg.session) {
      chrome.storage.local.set({ lxsSession: msg.session }, function () {
        syncSession(msg.session);
      });
    }
  });

  document.addEventListener(
    "lxs-persist",
    function (ev) {
      if (ev.detail) chrome.storage.local.set({ lxsSession: ev.detail });
    },
    false
  );

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || !ev.data || ev.data.source !== "lxs-page") return;
    if (ev.data.type === "LXS_PERSIST" && ev.data.session) {
      chrome.storage.local.set({ lxsSession: ev.data.session });
    }
  });
})();
