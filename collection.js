(() => {
  const SHEET_ID = "1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY";
  const INDEX_GID = "346832350";
  const SKIP_TABS = new Set(["Shopping List", "Archetypes", "Experimental", "Exotic Armor", "Builds", "Perks", "Origin Traits", "Set Bonuses", "Artifact Mods", "Fragments", "Aspects", "Subclasses", "Encounters", "Transitions", "Raid Mods"]);
  const BUCKETS_ARMES = new Set([1498876634, 2465295065, 953998645]);
  const TTL = 30 * 60 * 1000;
  const CACHE_KEY = "vigieCollectionGodRollsV1";
  const PAGE_SIZE = 60;
  const el = {
    status: document.getElementById("collectionStatus"),
    search: document.getElementById("collectionSearch"),
    type: document.getElementById("collectionType"),
    onlyRecommended: document.getElementById("recommendedOnly"),
    count: document.getElementById("collectionCount"),
    results: document.getElementById("collectionResults"),
    more: document.getElementById("loadMore")
  };
  let weapons = [];
  let visibleLimit = PAGE_SIZE;

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  function csvRows(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const character = text[i];
      if (quoted) {
        if (character === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (character === '"') quoted = false;
        else field += character;
      } else if (character === '"') quoted = true;
      else if (character === ",") { row.push(field); field = ""; }
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += character;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function parseIndex(text) {
    return csvRows(text).slice(1).map(function (row) {
      return { tab: (row[0] || "").trim(), updated: (row[1] || "").trim(), status: (row[2] || "").trim() };
    }).filter(function (row) { return row.tab && row.status; });
  }

  function parseWeaponSheet(tab, text) {
    const rows = csvRows(text);
    if (!rows.length) return [];
    const headers = rows[0].map(function (header) { return header.replace(/^(WEAPON|INFO|PERKS|ANALYSIS|KEY)\s*/, "").trim(); });
    const column = function (name) { return headers.indexOf(name); };
    if (column("Name") < 0) return [];
    const exotic = column("Description") >= 0;
    if (!exotic && column("Perk 1") < 0) return [];
    return rows.slice(1).map(function (row) {
      const cell = function (name) { const index = column(name); return index < 0 ? "" : String(row[index] || "").trim(); };
      const nameLines = cell("Name").split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
      if (!nameLines.length) return null;
      const perks = [];
      ["Barrel", "Mag", "Perk 1", "Perk 2", "Origin Trait"].forEach(function (label) {
        const value = cell(label);
        if (value) perks.push({ label: label, options: value.split("\n").map(function (option) { return option.trim(); }).filter(Boolean) });
      });
      const info = [];
      headers.forEach(function (header, index) {
        const value = String(row[index] || "").trim();
        if (!value || ["Name", "Rank", "Tier", "Notes", "Description", "Barrel", "Mag", "Perk 1", "Perk 2", "Origin Trait"].includes(header)) return;
        info.push({ label: header, value: value });
      });
      return {
        name: nameLines[0],
        variant: nameLines.slice(1).join(" · "),
        tab: tab,
        tier: cell("Tier"),
        rank: cell("Rank"),
        notes: cell("Notes"),
        exotic: exotic,
        description: exotic ? cell("Description") : "",
        info: info,
        perks: perks
      };
    }).filter(Boolean);
  }

  async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.text();
  }

  function sheetUrl(query) {
    return "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&" + query;
  }

  async function loadRecommendations() {
    const indexText = await fetchText(sheetUrl("gid=" + INDEX_GID));
    const tabs = parseIndex(indexText).filter(function (entry) { return !SKIP_TABS.has(entry.tab); });
    const byTab = new Array(tabs.length);
    let next = 0, done = 0;
    async function worker() {
      while (next < tabs.length) {
        const index = next++;
        const tab = tabs[index];
        try {
          const text = await fetchText(sheetUrl("sheet=" + encodeURIComponent(tab.tab)));
          byTab[index] = parseWeaponSheet(tab.tab, text);
        } catch (_) { byTab[index] = []; }
        done++;
        el.status.textContent = "Chargement des rolls communautaires… " + done + "/" + tabs.length + " catégories";
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, tabs.length) }, worker));
    return byTab.flat();
  }

  async function loadGameWeapons() {
    const manifestResponse = await VIGIE_BUNGIE.fetchApi("/Destiny2/Manifest/");
    const manifestData = await manifestResponse.json();
    if (!manifestResponse.ok || manifestData.ErrorStatus !== "Success") throw new Error(manifestData.Message || "Le manifeste Bungie est indisponible.");
    const manifest = manifestData.Response;
    const definitionsPath = manifest.jsonWorldComponentContentPaths.en.DestinyInventoryItemLiteDefinition || manifest.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition;
    if (!definitionsPath) throw new Error("Bungie n’a pas renvoyé le catalogue des armes.");
    const response = await VIGIE_BUNGIE.fetchPublic(definitionsPath);
    if (!response.ok) throw new Error("Téléchargement du catalogue Bungie impossible (HTTP " + response.status + ").");
    const definitions = await response.json();
    return Object.values(definitions).filter(function (definition) {
      return definition && definition.itemType === 3 && definition.inventory && BUCKETS_ARMES.has(Number(definition.inventory.bucketTypeHash)) && definition.displayProperties && definition.displayProperties.name && !definition.redacted;
    }).map(function (definition) {
      return {
        hash: Number(definition.hash),
        name: definition.displayProperties.name,
        icon: definition.displayProperties.icon || "",
        type: definition.itemTypeDisplayName || "Arme",
        exotic: Number(definition.inventory.tierType) === 6
      };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, "en"); });
  }

  function addRecommendations(catalog, recommendations) {
    const byName = new Map();
    recommendations.forEach(function (recommendation) {
      const key = normalize(recommendation.name);
      if (!byName.has(key)) byName.set(key, []);
      const existing = byName.get(key);
      const rollKey = JSON.stringify(recommendation.perks.map(function (perk) { return [perk.label, perk.options]; }));
      if (!existing.some(function (roll) { return roll._key === rollKey; })) {
        recommendation._key = rollKey;
        existing.push(recommendation);
      }
    });
    return catalog.map(function (weapon) {
      const key = normalize(weapon.name);
      const withoutVariant = normalize(weapon.name.replace(/\s*\([^)]*\)\s*$/, ""));
      weapon.rolls = byName.get(key) || byName.get(withoutVariant) || [];
      return weapon;
    });
  }

  function rollMarkup(roll) {
    const main = ["Perk 1", "Perk 2"];
    const columns = main.map(function (label) {
      const perk = roll.perks.find(function (entry) { return entry.label === label; });
      return '<div class="perk-column"><b>' + escapeHtml(label === "Perk 1" ? "Trait · colonne 1" : "Trait · colonne 2") + '</b>' + escapeHtml(perk ? perk.options.join(" / ") : "—") + '</div>';
    }).join("");
    const extras = roll.perks.filter(function (entry) { return !main.includes(entry.label); }).map(function (entry) {
      return entry.label + ": " + entry.options.join(" / ");
    });
    const notes = [roll.notes, roll.info.filter(function (entry) { return /source|ammo|element|type/i.test(entry.label); }).map(function (entry) { return entry.label + ": " + entry.value; }).join(" · ")].filter(Boolean).join(" · ");
    return '<div class="roll-line"><div class="roll-heading"><span>God roll PvE · Aegis</span><span class="roll-tier">' + escapeHtml([roll.tier, roll.rank].filter(Boolean).join(" · ")) + '</span></div><div class="perk-columns">' + columns + '</div>' + (extras.length ? '<div class="roll-more">' + escapeHtml(extras.join(" · ")) + '</div>' : "") + (notes ? '<p class="roll-notes">' + escapeHtml(notes) + '</p>' : "") + '</div>';
  }

  function render() {
    const query = normalize(el.search.value);
    const type = el.type.value;
    const onlyRecommended = el.onlyRecommended.checked;
    const filtered = weapons.filter(function (weapon) {
      if (type && weapon.type !== type) return false;
      if (onlyRecommended && !weapon.rolls.length) return false;
      if (!query) return true;
      const text = [weapon.name, weapon.type, ...(weapon.rolls || []).flatMap(function (roll) {
        return [roll.tier, roll.rank, roll.notes, roll.variant, ...roll.perks.flatMap(function (perk) { return [perk.label, ...perk.options]; })];
      })].join(" ");
      return normalize(text).includes(query);
    });
    el.count.textContent = filtered.length + " arme(s) · " + filtered.filter(function (weapon) { return weapon.rolls.length; }).length + " avec un roll recommandé";
    const shown = filtered.slice(0, visibleLimit);
    if (!shown.length) {
      el.results.innerHTML = '<p class="weapon-empty">Aucune arme ne correspond. Essaie un autre nom de perk ou désactive « Rolls recommandés seulement ».</p>';
    } else {
      el.results.innerHTML = shown.map(function (weapon) {
        const icon = weapon.icon ? '<img class="weapon-art" loading="lazy" src="https://www.bungie.net' + escapeHtml(weapon.icon) + '" alt="">' : '<div class="weapon-art" aria-hidden="true"></div>';
        const rolls = weapon.rolls.slice(0, 2).map(rollMarkup).join("");
        const more = weapon.rolls.length > 2 ? '<div class="roll-more">+' + (weapon.rolls.length - 2) + ' autre(s) roll(s) recommandé(s)</div>' : "";
        const badge = weapon.rolls.length ? '<span class="weapon-badge">God roll PvE</span>' : (weapon.exotic ? '<span class="weapon-badge exotic">Exotique</span>' : "");
        return '<article class="weapon-card">' + icon + '<div class="weapon-copy"><div class="weapon-title"><h2>' + escapeHtml(weapon.name) + '</h2>' + badge + '</div><div class="weapon-meta">' + escapeHtml(weapon.type) + ' · ' + (weapon.exotic ? "Exotique" : "Arme légendaire") + '</div>' + (rolls || '<div class="roll-more">Aucune recommandation PvE trouvée dans la liste Aegis.</div>') + more + '</div></article>';
      }).join("");
    }
    el.more.hidden = filtered.length <= visibleLimit;
  }

  function fillTypes() {
    const types = Array.from(new Set(weapons.map(function (weapon) { return weapon.type; }))).sort(function (a, b) { return a.localeCompare(b, "en"); });
    types.forEach(function (type) {
      const option = document.createElement("option");
      option.value = type; option.textContent = type;
      el.type.appendChild(option);
    });
  }

  async function init() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.savedAt < TTL && Array.isArray(cached.catalog) && Array.isArray(cached.recommendations)) {
        weapons = addRecommendations(cached.catalog, cached.recommendations);
        el.status.textContent = "Catalogue en cache · mise à jour des recommandations dans " + Math.max(1, Math.round((TTL - (Date.now() - cached.savedAt)) / 60000)) + " min.";
        fillTypes(); render();
        return;
      }
    } catch (_) {}

    el.status.textContent = "Chargement du catalogue Bungie et de la liste de rolls PvE…";
    const results = await Promise.allSettled([loadGameWeapons(), loadRecommendations()]);
    const catalog = results[0].status === "fulfilled" ? results[0].value : [];
    const recommendations = results[1].status === "fulfilled" ? results[1].value : [];
    if (!catalog.length && !recommendations.length) {
      el.status.textContent = "Impossible de charger les données. Vérifie l’URL du Worker sur oauth.html et réessaie.";
      el.results.innerHTML = '<p class="weapon-empty">Le catalogue Bungie et la liste des god rolls sont indisponibles.</p>';
      return;
    }
    weapons = addRecommendations(catalog, recommendations);
    fillTypes(); render();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), catalog: catalog, recommendations: recommendations })); } catch (_) {}
    const avertissements = [];
    if (results[0].status === "rejected") avertissements.push("catalogue Bungie indisponible");
    if (results[1].status === "rejected") avertissements.push("liste communautaire indisponible");
    el.status.textContent = avertissements.length ? avertissements.join(" · ") : catalog.length + " armes du catalogue Bungie · " + recommendations.length + " rolls PvE communautaires.";
  }

  el.search.addEventListener("input", function () { visibleLimit = PAGE_SIZE; render(); });
  el.type.addEventListener("change", function () { visibleLimit = PAGE_SIZE; render(); });
  el.onlyRecommended.addEventListener("change", function () { visibleLimit = PAGE_SIZE; render(); });
  el.more.addEventListener("click", function () { visibleLimit += PAGE_SIZE; render(); });
  init().catch(function (error) {
    console.error(error);
    el.status.textContent = "Erreur de chargement : " + error.message;
  });
})();
