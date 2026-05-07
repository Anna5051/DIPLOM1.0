(function () {
  function ensureDialogRoot() {
    let root = document.getElementById("siteDialogRoot");
    if (root) return root;
    root = document.createElement("div");
    root.id = "siteDialogRoot";
    document.body.appendChild(root);
    return root;
  }

  function closeDialog(overlay) {
    if (!overlay) return;
    overlay.classList.remove("open");
    window.setTimeout(() => overlay.remove(), 140);
  }

  function buildDialogBase(title, message) {
    const overlay = document.createElement("div");
    overlay.className = "site-dialog-overlay";
    overlay.innerHTML = `
      <div class="site-dialog-card" role="dialog" aria-modal="true">
        <div class="site-dialog-title"></div>
        <div class="site-dialog-message"></div>
      </div>
    `;

    const card = overlay.querySelector(".site-dialog-card");
    const titleEl = overlay.querySelector(".site-dialog-title");
    const messageEl = overlay.querySelector(".site-dialog-message");
    titleEl.textContent = title || "Подтверждение";
    messageEl.textContent = message || "";
    return { overlay, card };
  }

  window.siteConfirm = function siteConfirm(
    message,
    options = {},
  ) {
    return new Promise((resolve) => {
      const { overlay, card } = buildDialogBase(
        options.title || "Подтверждение",
        message,
      );

      const actions = document.createElement("div");
      actions.className = "site-dialog-actions";
      actions.innerHTML = `
        <button type="button" class="site-dialog-btn site-dialog-btn-cancel"></button>
        <button type="button" class="site-dialog-btn site-dialog-btn-confirm"></button>
      `;
      card.appendChild(actions);

      const cancelBtn = actions.querySelector(".site-dialog-btn-cancel");
      const confirmBtn = actions.querySelector(".site-dialog-btn-confirm");
      cancelBtn.textContent = options.cancelText || "Отмена";
      confirmBtn.textContent = options.confirmText || "Подтвердить";
      if (options.danger) confirmBtn.classList.add("danger");

      const cleanup = (result) => {
        closeDialog(overlay);
        resolve(result);
      };

      cancelBtn.addEventListener("click", () => cleanup(false));
      confirmBtn.addEventListener("click", () => cleanup(true));
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cleanup(false);
      });

      ensureDialogRoot().appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add("open"));
      confirmBtn.focus();
    });
  };

  window.sitePrompt = function sitePrompt(
    message,
    options = {},
  ) {
    return new Promise((resolve) => {
      const { overlay, card } = buildDialogBase(
        options.title || "Введите значение",
        message,
      );

      const input = document.createElement("input");
      input.type = "text";
      input.className = "site-dialog-input";
      input.placeholder = options.placeholder || "";
      input.value = options.defaultValue || "";
      card.appendChild(input);

      const actions = document.createElement("div");
      actions.className = "site-dialog-actions";
      actions.innerHTML = `
        <button type="button" class="site-dialog-btn site-dialog-btn-cancel"></button>
        <button type="button" class="site-dialog-btn site-dialog-btn-confirm"></button>
      `;
      card.appendChild(actions);

      const cancelBtn = actions.querySelector(".site-dialog-btn-cancel");
      const confirmBtn = actions.querySelector(".site-dialog-btn-confirm");
      cancelBtn.textContent = options.cancelText || "Отмена";
      confirmBtn.textContent = options.confirmText || "Применить";

      const cleanup = (result) => {
        closeDialog(overlay);
        resolve(result);
      };

      cancelBtn.addEventListener("click", () => cleanup(null));
      confirmBtn.addEventListener("click", () => {
        const value = input.value.trim();
        cleanup(value || null);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmBtn.click();
        }
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cleanup(null);
      });

      ensureDialogRoot().appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add("open"));
      input.focus();
      input.select();
    });
  };
})();
