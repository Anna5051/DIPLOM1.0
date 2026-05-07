(function () {
  const MAX_ITEMS = 4;
  const DURATION_MS = 4500;

  function getStack() {
    let stack = document.getElementById("siteNotifyStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "siteNotifyStack";
      stack.className = "site-notify-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  function notify(message, type) {
    if (!message) {
      return;
    }
    const stack = getStack();
    while (stack.children.length >= MAX_ITEMS) {
      stack.removeChild(stack.firstElementChild);
    }

    const node = document.createElement("div");
    node.className = "site-notify site-notify--" + (type || "info");
    node.textContent = message;
    stack.appendChild(node);

    setTimeout(() => {
      node.remove();
    }, DURATION_MS);
  }

  // Авто-остановка локального сервера, когда закрыта вкладка приложения.
  (function setupClientPresence() {
    if (!/^https?:\/\/localhost(?::\d+)?$/i.test(window.location.origin)) {
      return;
    }

    const key = "charitorClientTabId";
    let tabId = sessionStorage.getItem(key);
    if (!tabId) {
      tabId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, tabId);
    }

    const sendPresence = (action, useBeacon = false) => {
      const payload = JSON.stringify({ action, tabId });
      if (useBeacon && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/client-presence", blob);
        return;
      }
      fetch("/client-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    sendPresence("open");
    const heartbeat = setInterval(() => sendPresence("heartbeat"), 10000);

    window.addEventListener("pagehide", () => {
      clearInterval(heartbeat);
      sendPresence("close", true);
    });
  })();

  window.notifyUser = notify;
})();
