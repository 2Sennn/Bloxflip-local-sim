function $(id) {
  return document.getElementById(id);
}

function setStatus(txt, kind) {
  var el = $("status");
  el.textContent = txt || "";
  el.className = "foot" + (kind ? " " + kind : "");
}

function readForm() {
  return {
    startBalance: parseFloat($("bal").value) || 0,
    startWager: parseFloat($("wager").value) || 0,
    username: ($("user").value || "").trim() || "Player",
  };
}

function pushToTabs(session) {
  chrome.tabs.query({ url: ["*://bloxflip.com/*", "*://*.bloxflip.com/*"] }, function (tabs) {
    var i;
    for (i = 0; i < tabs.length; i++) {
      chrome.tabs
        .sendMessage(tabs[i].id, { type: "LXS_SESSION", session: session })
        .catch(function () {
          // tab has no content script (not bloxflip, or not loaded yet)
        });
    }
  });
}

function commitSession(fresh) {
  chrome.storage.local.get("lxsSession", function (r) {
    var prev = r.lxsSession || {};
    var f = readForm();
    var session;
    if (fresh) {
      session = {
        startBalance: f.startBalance,
        startWager: f.startWager,
        username: f.username,
        userId: crypto.randomUUID(),
        flip: f.startBalance,
        simWager: 0,
        baseTotalPlayed: f.startWager,
        touched: true,
        fresh: true,
        ledger: { mines: [], towers: [], games: {}, txs: [] },
      };
    } else {
      session = prev;
      session.username = f.username;
      session.startBalance = f.startBalance;
      session.startWager = f.startWager;
      session.fresh = false;
      session.touched = true;
    }

    chrome.storage.local.set({ lxsSession: session }, function () {
      pushToTabs(session);
      setStatus(fresh ? "session reset" : "saved", "ok");
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get("lxsSession", function (r) {
    var s = r.lxsSession;
    if (!s) return;
    if (s.startBalance != null) $("bal").value = s.startBalance;
    if (s.startWager != null) $("wager").value = s.startWager;
    if (s.username) $("user").value = s.username;
    if (s.flip != null) {
      setStatus("balance " + s.flip + " · wager " + (s.simWager || 0), "ok");
    }
  });

  $("refresh").addEventListener("click", function () {
    commitSession(true);
  });

  $("user").addEventListener("change", function () {
    commitSession(false);
  });

  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("a");
    if (!a || !a.href) return;
    if (a.href.indexOf("http") !== 0) return;
    ev.preventDefault();
    chrome.tabs.create({ url: a.href });
  });
});
