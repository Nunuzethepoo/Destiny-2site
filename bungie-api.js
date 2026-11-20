// VIGIE's browser client talks only to the same-origin-controlled Worker relay.
// Configure the Worker URL from oauth.html; never place Bungie's API key in this file.
window.VIGIE_BUNGIE = (() => {
  const getWorker = () => (localStorage.getItem("vigieWorkerUrl") || "").replace(/\/$/, "");

  function workerPath(path) {
    const worker = getWorker();
    if (!worker) throw new Error("Configure d’abord l’URL du Worker depuis oauth.html.");
    return `${worker}/api/proxy?path=${encodeURIComponent(path)}`;
  }

  function authHeaders(headers = {}) {
    const token = sessionStorage.getItem("jeton");
    return { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  return {
    fetchApi(path, options = {}) {
      return fetch(workerPath(`/Platform${path}`), {
        ...options,
        headers: authHeaders(options.headers || {})
      });
    },
    fetchPublic(path, options = {}) {
      return fetch(workerPath(path), options);
    },
    async exchangeCode(code, redirectUri) {
      const worker = getWorker();
      if (!worker) throw new Error("Configure l’URL de ton Worker avant de te connecter.");
      const response = await fetch(`${worker}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, redirectUri })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "La connexion Bungie a échoué.");
      return result;
    },
    setWorkerUrl(url) {
      const clean = String(url || "").trim().replace(/\/$/, "");
      if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/i.test(clean)) {
        throw new Error("L’URL doit être celle du Worker Cloudflare, au format https://nom.compte.workers.dev");
      }
      localStorage.setItem("vigieWorkerUrl", clean);
      return clean;
    }
  };
})();
