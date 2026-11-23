(() => {
  const SHEET_ID = "1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY";
  const INDEX_GID = "346832350";
  const SKIP_TABS = new Set(["Shopping List", "Archetypes", "Experimental", "Exotic Armor", "Builds", "Perks", "Origin Traits", "Set Bonuses", "Artifact Mods", "Fragments", "Aspects", "Subclasses", "Encounters", "Transitions", "Raid Mods"]);
  const BUCKETS_ARMES = new Set([1498876634, 2465295065, 953998645]);
  const TTL = 30 * 60 * 1000;
  const CACHE_KEY = "vigieCollectionGodRollsV5";
  const PAGE_SIZE = 60;
  const el = {
    status: document.getElementById("collectionStatus"),
    search: document.getElementById("collectionSearch"),
    type: document.getElementById("collectionType"),
    perk: document.getElementById("collectionPerk"),
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

  function compteNomsFrancais(catalog) {
    return catalog.filter(function (weapon) { return weapon.name && weapon.nameEn && weapon.name !== weapon.nameEn; }).length;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  const TYPE_FR = {
    "Auto Rifle": "Fusil automatique", "Combat Bow": "Arc de combat", "Bow": "Arc de combat",
    "Hand Cannon": "Revolver", "Pulse Rifle": "Fusil à impulsion", "Scout Rifle": "Fusil d’éclaireur",
    "Sidearm": "Arme de poing", "Submachine Gun": "Pistolet-mitrailleur", "Shotgun": "Fusil à pompe",
    "Fusion Rifle": "Fusil à fusion", "Sniper Rifle": "Fusil de précision", "Trace Rifle": "Fusil à rayon",
    "Grenade Launcher": "Lance-grenades", "Special Ammo Grenade Launcher": "Lance-grenades spécial",
    "Rocket Launcher": "Lance-roquettes", "Machine Gun": "Mitrailleuse", "Sword": "Épée",
    "Linear Fusion Rifle": "Fusil à fusion linéaire", "Glaive": "Glaive"
  };
  const COL_FR = { "Barrel": "Canon", "Mag": "Chargeur", "Perk 1": "Trait · colonne 1", "Perk 2": "Trait · colonne 2", "Origin Trait": "Trait d’origine" };
  let traductionsPerks = {};

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
    const type = "DestinyInventoryItemLiteDefinition";
    const cheminsManifest = manifest.jsonWorldComponentContentPaths || {};
    const cheminsEn = cheminsManifest.en || {};
    const localeFr = Object.keys(cheminsManifest).find(function (locale) {
      const normalizedLocale = locale.toLowerCase();
      return normalizedLocale === "fr" || normalizedLocale.indexOf("fr-") === 0;
    });
    const cheminsFr = cheminsManifest.fr || (localeFr ? cheminsManifest[localeFr] : {}) || {};
    const pathEn = cheminsEn[type] || cheminsEn.DestinyInventoryItemDefinition;
    const pathFrLite = cheminsFr[type];
    const pathFrComplet = cheminsFr.DestinyInventoryItemDefinition;
    const pathFr = pathFrLite || pathFrComplet;
    if (!pathEn) throw new Error("Bungie n’a pas renvoyé le catalogue des armes.");
    async function chargerDefinitions(path) {
      const response = await VIGIE_BUNGIE.fetchPublic(path);
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }
    const [defsEn, defsFrChargees] = await Promise.all([
      chargerDefinitions(pathEn),
      pathFr ? chargerDefinitions(pathFr).catch(function () { return {}; }) : Promise.resolve({})
    ]);
    let defsFr = defsFrChargees || {};
    function compterNomsTraduits(definitionsFr) {
      return Object.keys(defsEn).filter(function (hash) {
        const english = defsEn[hash];
        const french = definitionsFr[hash];
        const nomEn = english && english.displayProperties && english.displayProperties.name;
        const nomFr = french && french.displayProperties && french.displayProperties.name;
        return english && english.itemType === 3 && english.inventory &&
          BUCKETS_ARMES.has(Number(english.inventory.bucketTypeHash)) &&
          nomEn && nomFr && nomFr.trim() && nomFr.trim() !== nomEn.trim();
      }).length;
    }
    if (!compterNomsTraduits(defsFr) && pathFrComplet && pathFrComplet !== pathFr) {
      el.status.textContent = "La table française légère ne contient pas de noms traduits ; chargement de la table Bungie complète…";
      try {
        defsFr = await chargerDefinitions(pathFrComplet);
      } catch (_) {
        defsFr = {};
      }
    }
    const nomsParHash = {};
    const parNomAnglais = {};
    Object.keys(defsEn).forEach(function (hash) {
      const english = defsEn[hash];
      const french = defsFr[hash];
      const nomFr = french && french.displayProperties && french.displayProperties.name;
      if (!english || !english.displayProperties || !english.displayProperties.name || !nomFr || !nomFr.trim()) return;
      nomsParHash[hash] = nomFr.trim();
      const englishKey = normalize(english.displayProperties.name);
      if (!parNomAnglais[englishKey]) parNomAnglais[englishKey] = nomFr.trim();
    });
    traductionsPerks = parNomAnglais;
    return Object.values(defsEn).filter(function (definition) {
      return definition && definition.itemType === 3 && definition.inventory && BUCKETS_ARMES.has(Number(definition.inventory.bucketTypeHash)) && definition.displayProperties && definition.displayProperties.name && !definition.redacted;
    }).map(function (definition) {
      return {
        hash: Number(definition.hash),
        nameEn: definition.displayProperties.name,
        name: nomsParHash[String(definition.hash)] || definition.displayProperties.name,
        icon: definition.displayProperties.icon || "",
        type: TYPE_FR[definition.itemTypeDisplayName] || definition.itemTypeDisplayName || "Arme",
        exotic: Number(definition.inventory.tierType) === 6
      };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, "en"); });
  }

  function addRecommendations(catalog, recommendations, translations) {
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
      const englishName = weapon.nameEn || weapon.name;
      const key = normalize(englishName);
      const withoutVariant = normalize(englishName.replace(/\s*\([^)]*\)\s*$/, ""));
      weapon.rolls = (byName.get(key) || byName.get(withoutVariant) || []).map(function (roll) {
        return Object.assign({}, roll, { perks: roll.perks.map(function (perk) {
          return Object.assign({}, perk, {
            label: COL_FR[perk.label] || perk.label,
            optionsEn: perk.options.slice(),
            options: perk.options.map(function (option) { return translations[normalize(option)] || option; })
          });
        }) });
      });
      return weapon;
    });
  }

  function catalogueDepuisRolls(recommendations) {
    const parNom = new Map();
    recommendations.forEach(function (recommendation) {
      const key = normalize(recommendation.name);
      if (!key || parNom.has(key)) return;
      parNom.set(key, {
        hash: 0,
        nameEn: recommendation.name,
        name: recommendation.name,
        icon: "",
        type: TYPE_FR[recommendation.tab] || recommendation.tab || "Arme recommandée",
        exotic: Boolean(recommendation.exotic)
      });
    });
    return Array.from(parNom.values());
  }

  function afficherToutSiAucunRoll() {
    if (!weapons.some(function (weapon) { return weapon.rolls && weapon.rolls.length; })) {
      el.onlyRecommended.checked = false;
    }
  }

  function garderTraductionsUtiles(recommendations, toutesLesTraductions) {
    const utiles = {};
    recommendations.forEach(function (recommendation) {
      (recommendation.perks || []).forEach(function (perk) {
        (perk.options || []).forEach(function (option) {
          const key = normalize(option);
          if (toutesLesTraductions[key]) utiles[key] = toutesLesTraductions[key];
        });
      });
    });
    traductionsPerks = utiles;
  }

  function rollMarkup(roll) {
    const main = ["Trait · colonne 1", "Trait · colonne 2"];
    const columns = main.map(function (label) {
      const perk = roll.perks.find(function (entry) { return entry.label === label; });
      return '<div class="perk-column"><b>' + escapeHtml(label) + '</b>' + escapeHtml(perk ? perk.options.join(" / ") : "—") + '</div>';
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
    const selectedPerk = el.perk.value;
    const onlyRecommended = el.onlyRecommended.checked;
    const filtered = weapons.filter(function (weapon) {
      if (type && weapon.type !== type) return false;
      if (onlyRecommended && !weapon.rolls.length) return false;
      if (selectedPerk && !(weapon.rolls || []).some(function (roll) {
        return (roll.perks || []).some(function (perk) {
          const noms = (perk.optionsEn || []).concat(perk.options || []);
          return noms.some(function (nom) { return normalize(nom) === selectedPerk; });
        });
      })) return false;
      if (!query) return true;
      const text = [weapon.name, weapon.nameEn, weapon.type, ...(weapon.rolls || []).flatMap(function (roll) {
        return [roll.tier, roll.rank, roll.notes, roll.variant, ...roll.perks.flatMap(function (perk) { return [perk.label, ...perk.options, ...(perk.optionsEn || [])]; })];
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

  function fillPerks() {
    const precedent = el.perk.value;
    el.perk.innerHTML = "";
    const tous = document.createElement("option");
    tous.value = "";
    tous.textContent = "Tous les perks";
    el.perk.appendChild(tous);

    const perks = new Map();
    weapons.forEach(function (weapon) {
      (weapon.rolls || []).forEach(function (roll) {
        (roll.perks || []).forEach(function (perk) {
          (perk.options || []).forEach(function (nom, index) {
            const nomSource = (perk.optionsEn || [])[index] || nom;
            const valeur = normalize(nomSource);
            if (valeur && !perks.has(valeur)) perks.set(valeur, nom || nomSource);
          });
        });
      });
    });
    Array.from(perks.entries()).sort(function (a, b) { return a[1].localeCompare(b[1], "fr"); }).forEach(function (entree) {
      const option = document.createElement("option");
      option.value = entree[0];
      option.textContent = entree[1];
      el.perk.appendChild(option);
    });
    if (perks.has(precedent)) el.perk.value = precedent;
  }

  async function init() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.savedAt < TTL && Array.isArray(cached.catalog) && cached.catalog.length && Array.isArray(cached.recommendations)) {
        traductionsPerks = cached.perkTranslations || {};
        weapons = addRecommendations(cached.catalog, cached.recommendations, traductionsPerks);
        afficherToutSiAucunRoll();
        el.status.textContent = "Catalogue en cache · " + compteNomsFrancais(cached.catalog) + " nom(s) français distinct(s) · mise à jour dans " + Math.max(1, Math.round((TTL - (Date.now() - cached.savedAt)) / 60000)) + " min.";
        fillTypes(); fillPerks(); render();
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cached)); } catch (_) {}
        return;
      }
    } catch (_) {}

    el.status.textContent = "Chargement du catalogue Bungie et de la liste de rolls PvE…";
    const results = await Promise.allSettled([loadGameWeapons(), loadRecommendations()]);
    let catalog = results[0].status === "fulfilled" ? results[0].value : [];
    const recommendations = results[1].status === "fulfilled" ? results[1].value : [];
    const catalogueSecours = !catalog.length && recommendations.length > 0;
    if (catalogueSecours) catalog = catalogueDepuisRolls(recommendations);
    if (!catalog.length && !recommendations.length) {
      const erreurCatalogue = results[0].status === "rejected" && results[0].reason
        ? " Détail : " + (results[0].reason.message || String(results[0].reason))
        : "";
      el.status.textContent = "Impossible de charger les données. Vérifie l’URL du Worker sur oauth.html et réessaie." + erreurCatalogue;
      el.results.innerHTML = '<p class="weapon-empty">Le catalogue Bungie et la liste des god rolls sont indisponibles.</p>';
      return;
    }
    garderTraductionsUtiles(recommendations, traductionsPerks);
    weapons = addRecommendations(catalog, recommendations, traductionsPerks);
    afficherToutSiAucunRoll();
    if (catalogueSecours) el.onlyRecommended.checked = false;
    fillTypes(); fillPerks(); render();
    if (!catalogueSecours && catalog.length) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), catalog: catalog, recommendations: recommendations, perkTranslations: traductionsPerks })); } catch (_) {}
    }
    const avertissements = [];
    if (results[0].status === "rejected") avertissements.push("catalogue Bungie indisponible");
    if (results[1].status === "rejected") avertissements.push("liste communautaire indisponible");
    el.status.textContent = catalogueSecours
      ? catalog.length + " armes recommandées affichées en mode de secours. Vérifie l’URL du Worker dans Connexion Bungie pour restaurer le catalogue complet."
      : avertissements.length
        ? avertissements.join(" · ") + " · " + catalog.length + " arme(s) chargée(s)"
        : catalog.length + " armes du catalogue Bungie · " + compteNomsFrancais(catalog) + " nom(s) français distinct(s) · " + recommendations.length + " rolls PvE communautaires." ;
  }

  el.search.addEventListener("input", function () { visibleLimit = PAGE_SIZE; render(); });
  el.type.addEventListener("change", function () { visibleLimit = PAGE_SIZE; render(); });
  el.perk.addEventListener("change", function () { visibleLimit = PAGE_SIZE; render(); });
  el.onlyRecommended.addEventListener("change", function () { visibleLimit = PAGE_SIZE; render(); });
  el.more.addEventListener("click", function () { visibleLimit += PAGE_SIZE; render(); });
  init().catch(function (error) {
    console.error(error);
    el.status.textContent = "Erreur de chargement : " + error.message;
  });
})();
