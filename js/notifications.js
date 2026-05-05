(function () {
  const MAX_ITEMS = 4;
  const DURATION_MS = 4500;
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

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

  function getText(args) {
    return args
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        try {
          return JSON.stringify(item);
        } catch (error) {
          return String(item);
        }
      })
      .join(" ")
      .trim();
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

  window.notifyUser = notify;

  console.log = function (...args) {
    notify(getText(args), "info");
  };
  console.warn = function (...args) {
    notify(getText(args), "warning");
  };
  console.error = function (...args) {
    notify(getText(args), "error");
  };

  window.__originalConsole = originalConsole;
})();
