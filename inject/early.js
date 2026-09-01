(function () {
  var off = false;
  try {
    off = localStorage.getItem("bf_sim_off") === "1";
  } catch (e) {
    // localStorage throws in some privacy modes
  }
  if (off) {
    window.BfSim = { off: true };
    return;
  }
  // A second inject of this script list must not wrap fetch/XHR again.
  if (window.__lxsHook) {
    if (window.BfSim) window.BfSim.skip = true;
    return;
  }
  window.__lxsHook = 1;

  window.BfSim = {
    version: "1.3.5",
    sessionKey: "lxs_session",
    dbgOn: false,
    qHeld: false,
    tileBias: null,
    pendingSession: null,
    skip: false,
    off: false,
  };

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || !ev.data || ev.data.source !== "lxs-bridge") return;
    if (ev.data.type === "LXS_SESSION" && ev.data.session) {
      if (window.__lxsApplyCfg) window.__lxsApplyCfg(ev.data.session);
      else window.BfSim.pendingSession = ev.data.session;
    }
  });
})();
