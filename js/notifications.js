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

  // Мобильная нижняя панель навигации в стиле Janitor.
  (function setupMobileDock() {
    const path = window.location.pathname.toLowerCase();
    const isInternalPage = path.startsWith("/pages/");
    const blocked =
      path.endsWith("/index.html") ||
      path.endsWith("/autorization.html") ||
      path.endsWith("/register.html") ||
      path.includes("/pages/docs/") ||
      path.endsWith("/admin.html");

    if (!isInternalPage || blocked) return;
    if (document.getElementById("mobileDockNav")) return;

    const dock = document.createElement("nav");
    dock.id = "mobileDockNav";
    dock.className = "mobile-dock-nav";
    dock.setAttribute("aria-label", "Нижняя навигация");

    const current = path;
    const isActive = (target) => current.endsWith(target);

    dock.innerHTML = `
      <a href="/pages/main.html" class="mobile-dock-item ${isActive("/main.html") ? "active" : ""}" aria-label="Главная">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 3 10v10h6v-6h6v6h6V10l-9-7z" fill="currentColor" />
        </svg>
      </a>
      <a href="/pages/search.html" class="mobile-dock-item ${isActive("/search.html") ? "active" : ""}" aria-label="Поиск">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15.5 14h-.8l-.3-.3a6 6 0 1 0-.7.7l.3.3v.8L19 20.2 20.2 19 15.5 14zm-5.5 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" fill="currentColor" />
        </svg>
      </a>
      <a href="/pages/main.html" class="mobile-dock-center ${isActive("/main.html") ? "active" : ""}" aria-label="Главная">
        <img src="/img/icon.svg" alt="Главная" />
      </a>
      <a href="/pages/history.html" class="mobile-dock-item ${isActive("/history.html") ? "active" : ""}" aria-label="История">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h12v9H7l-3 3V4zm14 0h2v12h-6v-2h4V4z" fill="currentColor" />
        </svg>
      </a>
      <a href="/pages/profile.html" class="mobile-dock-item ${isActive("/profile.html") ? "active" : ""}" aria-label="Профиль">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z" fill="currentColor" />
        </svg>
      </a>
    `;

    document.body.classList.add("has-mobile-dock");
    document.body.appendChild(dock);
  })();

  // Мобильный поиск в стиле Janitor на странице search.
  (function setupMobileSearchHeader() {
    const path = window.location.pathname.toLowerCase();
    if (!path.endsWith("/search.html")) return;
    if (document.getElementById("mobileSearchHead")) return;

    const desktopInput = document.getElementById("globalSearchInput");
    if (!desktopInput) return;

    const host = document.querySelector("main.search-page");
    if (!host) return;

    const wrap = document.createElement("div");
    wrap.id = "mobileSearchHead";
    wrap.className = "mobile-search-head";
    wrap.innerHTML = `
      <div class="mobile-search-row">
        <input type="text" id="mobileSearchInput" placeholder="Search characters..." />
        <button type="button" id="mobileFiltersToggle" aria-label="Фильтры">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 18h4v-2h-4v2zm-7-8v2h18v-2H3zm3-6v2h12V4H6z" fill="currentColor" />
          </svg>
        </button>
      </div>
    `;

    host.prepend(wrap);
    const mobileInput = document.getElementById("mobileSearchInput");
    const filtersBtn = document.getElementById("mobileFiltersToggle");
    mobileInput.value = desktopInput.value || "";

    mobileInput.addEventListener("input", () => {
      desktopInput.value = mobileInput.value;
      desktopInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    mobileInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        desktopInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    filtersBtn.addEventListener("click", () => {
      document.body.classList.toggle("mobile-filters-open");
    });
  })();

  window.notifyUser = notify;
})();
