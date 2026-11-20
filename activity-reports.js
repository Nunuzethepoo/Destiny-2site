window.VIGIE_ACTIVITY_REPORTS = (() => {
  const MODE = { raid: { id: 4, label: "raid" }, dungeon: { id: 82, label: "donjon" } };
  const cacheKey = "vigieActivityDefinitionsFrV1";
  let definitions = {};

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  async function request(path) {
    const response = await VIGIE_BUNGIE.fetchApi(path);
    let data;
    try { data = await response.json(); } catch (_) { throw new Error("Bungie a renvoyé une réponse illisible. Réessaie dans un instant."); }
    if (!response.ok || (data.ErrorCode !== undefined && data.ErrorCode !== 1)) {
      throw new Error(data.Message || data.ErrorStatus || `Erreur Bungie HTTP ${response.status}.`);
    }
    return data.Response;
  }
  async function getPrimaryAccount() {
    const membershipId = sessionStorage.getItem("membershipId");
    if (!membershipId) throw new Error("La session Bungie a expiré. Reconnecte-toi depuis la page Connexion.");
    const memberships = await request(`/User/GetMembershipsById/${encodeURIComponent(membershipId)}/254/`);
    const account = (memberships.destinyMemberships || []).find(item => item.membershipId === memberships.primaryMembershipId) || (memberships.destinyMemberships || [])[0];
    if (!account) throw new Error("Aucun profil Destiny 2 n’est associé à ce compte Bungie.");
    return { membershipType: account.membershipType, membershipId: account.membershipId };
  }
  async function getCharacters(membershipType, membershipId) {
    const profile = await request(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=200`);
    const chars = profile.characters && profile.characters.data;
    if (chars && Object.keys(chars).length) return Object.values(chars).map(character => ({ id: String(character.characterId), classType: Number(character.classType) }));
    const ids = profile.profile && profile.profile.data && profile.profile.data.characterIds;
    if (!Array.isArray(ids) || !ids.length) throw new Error("Aucun personnage public n’a été trouvé sur ce profil.");
    return ids.map(id => ({ id: String(id), classType: -1 }));
  }
  function value(activity, key) {
    const entry = activity && activity.values && activity.values[key];
    return entry && entry.basic ? entry.basic.value : null;
  }
  function formatDate(period) {
    const date = new Date(period);
    return Number.isNaN(date.getTime()) ? "Date indisponible" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  function duration(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(value / 60)} min ${String(value % 60).padStart(2, "0")} s`;
  }
  async function activityDefinition(hash) {
    if (!hash) return null;
    if (!Object.keys(definitions).length) {
      try { definitions = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch (_) { definitions = {}; }
    }
    if (definitions[hash]) return definitions[hash];
    const response = await request(`/Destiny2/Manifest/DestinyActivityDefinition/${hash}/?lc=fr`);
    definitions[hash] = response;
    try { localStorage.setItem(cacheKey, JSON.stringify(definitions)); } catch (_) {}
    return response;
  }
  async function getActivities(account, mode) {
    const chosenMode = MODE[mode] || MODE.raid;
    const characters = account.characterIds ? account.characterIds.map(id => ({ id: String(id), classType: -1 })) : await getCharacters(account.membershipType, account.membershipId);
    const responses = await Promise.all(characters.map(async character => {
      const result = await request(`/Destiny2/${account.membershipType}/Account/${account.membershipId}/Character/${character.id}/Stats/Activities/?mode=${chosenMode.id}&count=15&page=0`);
      return (result.activities || []).map(activity => ({ ...activity, characterId: character.id, characterClass: character.classType }));
    }));
    const activities = responses.flat().sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime()).slice(0, 30);
    const hashes = [...new Set(activities.map(item => String(item.activityDetails && (item.activityDetails.directorActivityHash || item.activityDetails.referenceId) || "" )).filter(Boolean))];
    // Resolve a small batch at a time to keep the public manifest requests polite.
    for (let i = 0; i < hashes.length; i += 4) {
      await Promise.all(hashes.slice(i, i + 4).map(hash => activityDefinition(hash).catch(() => null)));
    }
    return activities;
  }
  function displayName(account) {
    const player = account && account.player && account.player.destinyUserInfo;
    return player && (player.bungieGlobalDisplayName || player.displayName) || "Gardien";
  }
  async function loadPostGame(activityId) {
    return request(`/Destiny2/Stats/PostGameCarnageReport/${encodeURIComponent(activityId)}/`);
  }
  function reportStats(activity) {
    const kills = Number(value(activity, "kills")) || 0;
    const deaths = Number(value(activity, "deaths")) || 0;
    const assists = Number(value(activity, "assists")) || 0;
    const completed = Number(value(activity, "completed")) === 1;
    const seconds = value(activity, "activityDurationSeconds");
    return `<span>${kills} éliminations</span><span>${deaths} morts</span><span>${assists} assists</span><span>${seconds == null ? "Durée indisponible" : duration(seconds)}</span><span class="report-result ${completed ? "is-win" : "is-loss"}">${completed ? "Terminée" : "Incomplète"}</span>`;
  }
  function pgcrMarkup(data, activityId) {
    const activity = data.activityDetails || {};
    const entries = Array.isArray(data.entries) ? data.entries.slice() : [];
    entries.sort((a, b) => (Number(value(b, "kills")) || 0) - (Number(value(a, "kills")) || 0));
    const hash = String(activity.directorActivityHash || activity.referenceId || "");
    return `<div class="pgcr-summary"><b>${escapeHtml(definitions[hash]?.displayProperties?.name || "Rapport de fin de partie")}</b><span>${escapeHtml(formatDate(activity.period))}</span><a href="https://www.bungie.net/7/en/PGCR?activityId=${encodeURIComponent(activityId)}" target="_blank" rel="noopener noreferrer">Ouvrir sur Bungie ↗</a></div><div class="pgcr-roster">${entries.map(entry => `<article><b>${escapeHtml(displayName(entry))}</b><span>${Number(value(entry, "kills")) || 0} élim. · ${Number(value(entry, "deaths")) || 0} morts · ${Number(value(entry, "assists")) || 0} assists</span><span>${escapeHtml(value(entry, "score") ?? "—")} points</span></article>`).join("") || "<p>Le rapport ne contient pas de statistiques de joueurs.</p>"}</div>`;
  }
  async function renderReports(container, account) {
    container.innerHTML = "";
    const activities = await getActivities(account, account.mode);
    if (!activities.length) {
      container.innerHTML = `<p class="report-empty">Aucun rapport de ${MODE[account.mode]?.label || "raid"} récent n’a été retourné. Vérifie la visibilité de ton profil Bungie ou ouvre un autre personnage.</p>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const activity of activities) {
      const details = activity.activityDetails || {};
      const hash = String(details.directorActivityHash || details.referenceId || "");
      const def = definitions[hash];
      const activityId = details.instanceId;
      const article = document.createElement("article");
      article.className = "activity-card";
      const classes = ["Titan", "Chasseur", "Arcaniste"];
      const classLabel = classes[activity.characterClass] || "Gardien";
      article.innerHTML = `<div class="activity-heading"><div><p class="activity-kicker">${escapeHtml(MODE[account.mode]?.label || "activité")} · ${escapeHtml(formatDate(activity.period))}</p><h2>${escapeHtml(def && def.displayProperties && def.displayProperties.name || `Activité ${hash ? "#" + hash : "inconnue"}`)}</h2></div><span class="activity-character">${classLabel}</span></div><div class="activity-stats">${reportStats(activity)}</div><button type="button" class="pgcr-toggle" ${activityId ? "" : "disabled"}>Afficher le rapport détaillé</button><div class="pgcr-content" hidden></div>`;
      const button = article.querySelector(".pgcr-toggle");
      button.addEventListener("click", async () => {
        const panel = article.querySelector(".pgcr-content");
        if (!panel.hidden) { panel.hidden = true; button.textContent = "Afficher le rapport détaillé"; return; }
        button.disabled = true;
        button.textContent = "Chargement du rapport…";
        try {
          const data = await loadPostGame(activityId);
          panel.innerHTML = pgcrMarkup(data, activityId);
          panel.hidden = false;
          button.textContent = "Masquer le rapport";
        } catch (error) {
          panel.innerHTML = `<p class="report-error">${escapeHtml(error.message || "Rapport indisponible.")}</p>`;
          panel.hidden = false;
          button.textContent = "Réessayer le rapport";
        } finally { button.disabled = false; }
      });
      fragment.appendChild(article);
    }
    container.appendChild(fragment);
  }
  return { getPrimaryAccount, getCharacters, getActivities, renderReports };
})();

