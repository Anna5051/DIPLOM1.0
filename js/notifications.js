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

  window.notifyUser = notify;
})();
