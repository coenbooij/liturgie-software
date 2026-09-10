// Wachtwoordgate voor de beheerpagina's. Het wachtwoord wordt door de server gecontroleerd
// en in sessionStorage bewaard zodat het als header meegestuurd kan worden.
(function (global) {
  "use strict";

  const KEY = "liturgieWachtwoord";

  function getWachtwoord() {
    return sessionStorage.getItem(KEY) || "";
  }

  function forget() {
    sessionStorage.removeItem(KEY);
  }

  function authHeaders() {
    return { "X-Wachtwoord": getWachtwoord() };
  }

  async function verify(wachtwoord) {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wachtwoord }),
    });
    return res.ok;
  }

  function buildGate() {
    const gate = document.createElement("div");
    gate.className = "auth-gate";
    gate.innerHTML = `
      <div class="auth-card">
        <h2>Beveiligd</h2>
        <p>Voer het wachtwoord in om verder te gaan.</p>
        <input type="password" placeholder="Wachtwoord" autocomplete="current-password" />
        <button type="button">Ontgrendelen</button>
        <div class="auth-error"></div>
      </div>`;
    document.body.appendChild(gate);
    return gate;
  }

  // Toont de gate als er nog geen geldig wachtwoord is. Roept onReady aan zodra dat er is.
  async function ensureAuth(onReady) {
    const stored = getWachtwoord();
    if (stored && (await verify(stored).catch(() => false))) {
      onReady();
      return;
    }
    forget();

    const gate = buildGate();
    const input = gate.querySelector("input");
    const button = gate.querySelector("button");
    const error = gate.querySelector(".auth-error");

    async function tryUnlock() {
      const value = input.value.trim();
      if (!value) return;
      button.disabled = true;
      error.textContent = "";
      try {
        if (await verify(value)) {
          sessionStorage.setItem(KEY, value);
          gate.remove();
          onReady();
        } else {
          error.textContent = "Onjuist wachtwoord.";
        }
      } catch (err) {
        error.textContent = "Server niet bereikbaar.";
      } finally {
        button.disabled = false;
      }
    }

    button.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryUnlock();
      }
    });
    input.focus();
  }

  global.LiturgieAuth = { ensureAuth, authHeaders, forget };
})(window);
