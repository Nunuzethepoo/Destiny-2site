(() => {
  "use strict";

  const BUCKETS = new Map([
    [1498876634, "Cinétique"],
    [2465295065, "Énergie"],
    [953998645, "Puissante"]
  ]);
  const CLASSES = { 0: "Titan", 1: "Chasseur", 2: "Arcaniste" };
  const STATS_AFFICHEES = ["Armes", "Santé", "Classe", "Grenade", "Super", "Mêlée"];
  const STATS_ARME = {
    rpm: 4284893193,
    magazine: 3871231066,
    recharge: 3555269338
  };
  const SLOTS_PERKS = [3, 4];
  const MAX_SCENARIOS = 3;
  const el = {
    status: document.getElementById("labStatus"),
    reconnect: document.getElementById("labReconnect"),
    builds: document.getElementById("savedBuilds"),
    buildSummary: document.getElementById("buildSummary"),
    buildWeaponNote: document.getElementById("buildWeaponNote"),
    scenarioList: document.getElementById("scenarioList"),
    addScenario: document.getElementById("addScenario")
  };

  let liteDefinitions = {};
  let profile = null;
  let compte = null;
  let armes = [];
  let builds = [];
  let scenarios = [];
  const definitionsArmes = new Map();
  const definitionsPerks = new Map();
  const definitionsPlugSets = new Map();

  function normaliser(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  }

  function nombre(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function afficherStatut(message, state) {
    el.status.textContent = message;
    el.status.dataset.state = state || "";
  }

  function cheminIcone(path) {
    const value = String(path || "");
    return /^\/common\/destiny2_content\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes("..")
      ? "https://www.bungie.net" + value
      : "";
  }

  async function appelerBungie(path) {
    const response = await VIGIE_BUNGIE.fetchApi(path);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) {
      throw new Error("Bungie n’a pas renvoyé de JSON pour " + path + " (HTTP " + response.status + "). Vérifie le Worker ou reconnecte ton compte.");
    }
    if (!response.ok || data.ErrorStatus !== "Success") {
      if (response.status === 401) throw new Error("La session Bungie a expiré. Reconnecte ton compte.");
      throw new Error(data.Message || data.ErrorStatus || "La requête Bungie a échoué.");
    }
    return data.Response;
  }

  async function chargerTableLite(manifest) {
    const chemins = manifest.jsonWorldComponentContentPaths || {};
    const locale = chemins.fr || Object.keys(chemins).filter(function (key) { return key.toLowerCase().indexOf("fr") === 0; }).map(function (key) { return chemins[key]; })[0] || chemins.en || {};
    const chemin = locale.DestinyInventoryItemLiteDefinition || locale.DestinyInventoryItemDefinition;
    if (!chemin) throw new Error("Le manifeste Bungie ne contient pas la table des objets.");
    const response = await VIGIE_BUNGIE.fetchPublic(chemin);
    if (!response.ok) throw new Error("La table des objets Bungie est indisponible (HTTP " + response.status + ").");
    liteDefinitions = await response.json();
  }

  async function definitionCiblee(type, hash) {
    const path = "/Destiny2/Manifest/" + type + "/" + hash + "/?lc=fr";
    return appelerBungie(path);
  }

  async function membershipsPourCompte() {
    try {
      return await appelerBungie("/User/GetMembershipsForCurrentUser/");
    } catch (erreur) {
      const membershipId = sessionStorage.getItem("membershipId");
      if (!membershipId) throw erreur;
      return appelerBungie("/User/GetMembershipsById/" + membershipId + "/254/");
    }
  }

  function nomPerksActifs(item) {
    const sockets = profile && profile.itemComponents && profile.itemComponents.sockets && profile.itemComponents.sockets.data || {};
    const valeurs = sockets[item.idInstance] && sockets[item.idInstance].sockets || [];
    return SLOTS_PERKS.map(function (index) {
      const hash = Number(valeurs[index] && valeurs[index].plugHash);
      const definition = liteDefinitions[hash];
      return definition && definition.displayProperties && definition.displayProperties.name || "";
    }).filter(Boolean);
  }

  function ajouterArmes(liste, lieu, characterId, nomPersonnage, carte) {
    for (const item of liste || []) {
      const hash = Number(item.itemHash);
      const definition = liteDefinitions[hash];
      const bucket = Number(definition && definition.inventory && definition.inventory.bucketTypeHash);
      if (!definition || Number(definition.itemType) !== 3 || !BUCKETS.has(bucket) || !item.itemInstanceId) continue;
      const idInstance = String(item.itemInstanceId);
      const existant = carte.get(idInstance);
      if (existant) {
        if (lieu === "Équipée") {
          existant.lieu = lieu;
          existant.characterId = characterId || null;
          existant.nomPersonnage = nomPersonnage || "";
        }
        continue;
      }
      carte.set(idInstance, {
        idInstance: idInstance,
        hash: hash,
        nom: definition.displayProperties && definition.displayProperties.name || "Arme sans nom",
        icone: definition.displayProperties && definition.displayProperties.icon || "",
        type: definition.itemTypeDisplayName || "Arme",
        bucket: bucket,
        emplacement: BUCKETS.get(bucket),
        classe: Number(definition.classType),
        lieu: lieu,
        characterId: characterId || null,
        nomPersonnage: nomPersonnage || "",
        definitionLite: definition
      });
    }
  }

  function chargerArmesDuProfil() {
    const carte = new Map();
    const chars = profile.characters && profile.characters.data || {};
    const inventaires = profile.characterInventories && profile.characterInventories.data || {};
    const equipements = profile.characterEquipment && profile.characterEquipment.data || {};
    const inventaireProfil = profile.profileInventory && profile.profileInventory.data || {};
    ajouterArmes(inventaireProfil.items, "Coffre", null, "", carte);
    Object.keys(inventaires).forEach(function (id) {
      const personnage = chars[id] || {};
      ajouterArmes(inventaires[id] && inventaires[id].items, "Inventaire", id, CLASSES[personnage.classType] || "Gardien", carte);
    });
    Object.keys(equipements).forEach(function (id) {
      const personnage = chars[id] || {};
      ajouterArmes(equipements[id] && equipements[id].items, "Équipée", id, CLASSES[personnage.classType] || "Gardien", carte);
    });
    armes = Array.from(carte.values()).map(function (item) {
      item.perksActifs = nomPerksActifs(item);
      return item;
    }).sort(function (a, b) {
      return a.nom.localeCompare(b.nom, "fr") || a.lieu.localeCompare(b.lieu, "fr");
    });
  }

  function labelArme(item) {
    const traits = item.perksActifs && item.perksActifs.length ? " · " + item.perksActifs.join(" / ") : "";
    const gardien = item.nomPersonnage ? " · " + item.nomPersonnage : "";
    return item.nom + " · " + item.emplacement + " · " + item.lieu + gardien + traits;
  }

  function remplirSelectArmes(row, terme, valeurSouhaitee) {
    const select = row.weaponSelect;
    const valeur = valeurSouhaitee || select.value;
    const recherche = normaliser(terme);
    const visibles = armes.filter(function (item) {
      return !recherche || normaliser(labelArme(item)).includes(recherche);
    });
    if (valeur && !visibles.some(function (item) { return item.idInstance === valeur; })) {
      const conserve = armes.find(function (item) { return item.idInstance === valeur; });
      if (conserve) visibles.unshift(conserve);
    }
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = armes.length ? "Choisir une arme de ton inventaire…" : "Aucune arme trouvée";
    select.appendChild(placeholder);
    visibles.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item.idInstance;
      option.textContent = labelArme(item);
      select.appendChild(option);
    });
    if (valeur && visibles.some(function (item) { return item.idInstance === valeur; })) select.value = valeur;
  }

  function valeurStat(stats, hash) {
    const stat = stats && stats[String(hash)];
    return stat ? nombre(stat.value) : 0;
  }

  function statArme(item, definition, hash) {
    const composants = profile.itemComponents && profile.itemComponents.stats && profile.itemComponents.stats.data || {};
    const instanceStats = composants[item.idInstance] && composants[item.idInstance].stats;
    const valeurInstance = valeurStat(instanceStats, hash);
    if (valeurInstance > 0) return valeurInstance;
    const defStats = definition && definition.stats && definition.stats.stats;
    return valeurStat(defStats, hash);
  }

  async function chargerDefPerk(hash) {
    if (definitionsPerks.has(hash)) return definitionsPerks.get(hash);
    const lite = liteDefinitions[hash];
    if (lite && lite.displayProperties && lite.displayProperties.name) {
      const compact = {
        nom: lite.displayProperties.name,
        description: lite.displayProperties.description || "",
        icone: lite.displayProperties.icon || "",
        enhanced: Boolean(lite.plug && /enhanced|trait\.enhanced/i.test(lite.plug.plugCategoryIdentifier || ""))
      };
      definitionsPerks.set(hash, compact);
      return compact;
    }
    const definition = await definitionCiblee("DestinyInventoryItemDefinition", hash);
    const props = definition.displayProperties || {};
    const compact = {
      nom: props.name || "Perk",
      description: props.description || "",
      icone: props.icon || "",
      enhanced: Boolean(definition.plug && /enhanced|trait\.enhanced/i.test(definition.plug.plugCategoryIdentifier || ""))
    };
    definitionsPerks.set(hash, compact);
    return compact;
  }

  async function chargerPlugSet(hash) {
    if (definitionsPlugSets.has(hash)) return definitionsPlugSets.get(hash);
    const definition = await definitionCiblee("DestinyPlugSetDefinition", hash);
    definitionsPlugSets.set(hash, definition);
    return definition;
  }

  function plugHash(plug) {
    return Number(plug && (plug.plugItemHash || plug.itemHash)) || 0;
  }

  async function chargerOptionsPerks(item) {
    if (definitionsArmes.has(item.hash)) return definitionsArmes.get(item.hash);
    const definition = await definitionCiblee("DestinyInventoryItemDefinition", item.hash);
    const entrees = definition.sockets && definition.sockets.socketEntries || [];
    const socketsProfile = profile.itemComponents && profile.itemComponents.sockets && profile.itemComponents.sockets.data || {};
    const socketsInstance = socketsProfile[item.idInstance] && socketsProfile[item.idInstance].sockets || [];
    const options = [];
    for (let col = 0; col < SLOTS_PERKS.length; col++) {
      const index = SLOTS_PERKS[col];
      const entree = entrees[index] || {};
      const hashes = new Set();
      (entree.reusablePlugItems || []).forEach(function (plug) {
        const hash = plugHash(plug);
        if (hash) hashes.add(hash);
      });
      const setHashes = Array.from(new Set([entree.reusablePlugSetHash, entree.randomizedPlugSetHash].map(Number).filter(Boolean)));
      const sets = await Promise.all(setHashes.map(chargerPlugSet));
      sets.forEach(function (set) {
        (set.reusablePlugItems || []).forEach(function (plug) {
          const hash = plugHash(plug);
          if (hash) hashes.add(hash);
        });
      });
      const actuel = Number(socketsInstance[index] && socketsInstance[index].plugHash) || 0;
      if (actuel) hashes.add(actuel);
      const candidats = await Promise.all(Array.from(hashes).map(async function (hash) {
        try {
          const perk = await chargerDefPerk(hash);
          if (!perk.nom || normaliser(perk.nom) === "aucun") return null;
          return Object.assign({ hash: hash }, perk);
        } catch (_) {
          return null;
        }
      }));
      options[col] = candidats.filter(Boolean).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });
    }
    const result = { definition: definition, options: options };
    definitionsArmes.set(item.hash, result);
    return result;
  }

  function bonusConnu(perk, item) {
    const nom = normaliser(perk && perk.nom);
    const description = normaliser(perk && perk.description);
    const texte = nom + " " + description;
    const ameliore = Boolean(perk && perk.enhanced) || texte.includes("enhanced") || texte.includes("ameliore");
    if (texte.includes("focused fury") || texte.includes("charge progressive")) {
      return { valeur: 25, condition: "Bonus de 25 % après environ 35 % de tirs de précision du chargeur." };
    }
    if (texte.includes("frenzy") || texte.includes("frenesie")) {
      return { valeur: 15, condition: "Bonus de dégâts de 15 % quand le perk est actif." };
    }
    if (texte.includes("bait and switch") || (texte.includes("appat") && (texte.includes("echange") || texte.includes("changement")))) {
      return { valeur: 30, condition: "Bonus de 30 % après avoir infligé des dégâts avec les trois armes." };
    }
    if (texte.includes("collective action") || texte.includes("action collective")) {
      return { valeur: ameliore ? 33 : 30, condition: "Bonus contre les combattants PvE après une récupération élémentaire; 30 % (33 % amélioré)." };
    }
    if (texte.includes("reservoir burst") || texte.includes("explosion de reservoir") || texte.includes("explosion du reservoir")) {
      return { valeur: ameliore ? 33 : 30, condition: "Bonus sur le tir avec le chargeur plein; 30 % (33 % amélioré)." };
    }
    if (texte.includes("adagio")) {
      const type = normaliser(item && item.type);
      if (type.includes("hand cannon") || type.includes("revolver")) {
        return { valeur: 27, condition: "Bonus de 27 % pour les revolvers." };
      }
      if (type.includes("shotgun") || type.includes("fusil a pompe") || type.includes("combat bow") || type.includes("arc de combat")) {
        return { valeur: 30, condition: "Bonus de 30 % pour les fusils à pompe et les arcs." };
      }
    }
    if (texte.includes("full court")) {
      return { valeur: 0, condition: "Jusqu’à 35 % de bonus sur la partie explosive; le calcul n’applique pas ce bonus au tir direct." };
    }
    if (texte.includes("lasting impression") || texte.includes("impression durable")) {
      return { valeur: 0, condition: "Bonus de 35 % sur l’explosion; le calcul n’applique pas ce bonus au tir direct." };
    }
    return null;
  }

  function initialiserDetailPerk(row, index, perk, suggested) {
    const card = row.perkInfo[index];
    const amount = row.perkBonus[index];
    const uptime = row.perkUptime[index];
    card.querySelector("h3").textContent = perk ? perk.nom : "Aucun perk sélectionné";
    card.querySelector("p").textContent = perk
      ? (perk.description || "La description Bungie n’est pas disponible pour cette prise.")
      : "Choisis un perk de cette arme pour voir son effet.";
    const note = card.querySelector("small");
    if (!perk) {
      note.textContent = "Aucun bonus appliqué.";
      amount.value = "0";
      uptime.value = "100";
    } else if (suggested) {
      note.textContent = suggested.condition + " Valeur préremplie, modifiable.";
      amount.value = String(suggested.valeur);
      uptime.value = "100";
    } else {
      note.textContent = "Aucun pourcentage automatique fiable. Le texte Bungie est affiché; tu peux saisir le bonus connu.";
      amount.value = "0";
      uptime.value = "100";
    }
    row.update();
  }

  function remplirPerkSelect(select, options, activeHash) {
    select.replaceChildren();
    const aucune = document.createElement("option");
    aucune.value = "";
    aucune.textContent = "Aucun perk";
    select.appendChild(aucune);
    options.forEach(function (perk) {
      const option = document.createElement("option");
      option.value = String(perk.hash);
      option.textContent = perk.nom;
      select.appendChild(option);
    });
    if (activeHash && options.some(function (perk) { return String(perk.hash) === String(activeHash); })) {
      select.value = String(activeHash);
    } else {
      select.value = "";
    }
  }

  async function chargerDetailsArme(row, idInstance) {
    const item = armes.find(function (weapon) { return weapon.idInstance === idInstance; });
    row.item = item || null;
    row.token++;
    const token = row.token;
    row.weaponSummary.replaceChildren();
    row.perkOptions = [[], []];
    row.perkSelects.forEach(function (select) {
      remplirPerkSelect(select, [], 0);
    });
    row.perkInfo.forEach(function (card, index) {
      initialiserDetailPerk(row, index, null, null);
    });
    if (!item) {
      const placeholder = document.createElement("div");
      const title = document.createElement("strong");
      title.className = "weapon-title";
      title.textContent = "Choisis une arme";
      const meta = document.createElement("small");
      meta.className = "weapon-meta";
      meta.textContent = "Tes armes Bungie apparaîtront ici.";
      placeholder.append(title, meta);
      row.weaponSummary.appendChild(placeholder);
      row.weaponTitle = title;
      row.weaponMeta = meta;
      ["rpm", "magazine", "reloadStat"].forEach(function (key) { row.inputs[key].value = ""; });
      row.inputs.rpm.dataset.manual = "";
      row.inputs.magazine.dataset.manual = "";
      row.inputs.reload.value = "";
      row.update();
      return;
    }
    row.inputs.rpm.dataset.manual = "";
    row.inputs.magazine.dataset.manual = "";
    row.inputs.reload.value = "";
    const imagePath = cheminIcone(item.icone);
    if (imagePath) {
      const img = document.createElement("img");
      img.src = imagePath;
      img.alt = "";
      img.loading = "lazy";
      row.weaponSummary.appendChild(img);
    }
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.nom;
    const meta = document.createElement("small");
    meta.textContent = item.emplacement + " · " + item.lieu + (item.nomPersonnage ? " · " + item.nomPersonnage : "");
    copy.append(title, meta);
    row.weaponSummary.appendChild(copy);
    row.weaponTitle = title;
    row.weaponMeta = meta;
    row.weaponTitle.textContent = item.nom;
    row.weaponMeta.textContent = item.perksActifs.length ? "Perks installés : " + item.perksActifs.join(" · ") : "Chargement des données d’arme…";
    afficherStatut("Lecture des sockets de " + item.nom + "…", "");
    try {
      const detail = await chargerOptionsPerks(item);
      if (row.token !== token) return;
      const statsSockets = profile.itemComponents && profile.itemComponents.sockets && profile.itemComponents.sockets.data || {};
      const sockets = statsSockets[item.idInstance] && statsSockets[item.idInstance].sockets || [];
      const activeHashes = SLOTS_PERKS.map(function (index) { return Number(sockets[index] && sockets[index].plugHash) || 0; });
      row.perkOptions = detail.options;
      row.perkSelects.forEach(function (select, index) {
        remplirPerkSelect(select, detail.options[index] || [], activeHashes[index]);
        const hash = Number(select.value);
        const perk = (detail.options[index] || []).find(function (entry) { return entry.hash === hash; }) || null;
        initialiserDetailPerk(row, index, perk, perk ? bonusConnu(perk, item) : null);
      });
      row.weaponMeta.textContent = item.emplacement + " · " + item.lieu + (item.nomPersonnage ? " · " + item.nomPersonnage : "") + " · " + (detail.options[0].length + detail.options[1].length) + " choix de perks chargés";
      row.definition = detail.definition;
      const rpm = statArme(item, detail.definition, STATS_ARME.rpm);
      const magazine = statArme(item, detail.definition, STATS_ARME.magazine);
      const reload = statArme(item, detail.definition, STATS_ARME.recharge);
      if (!row.inputs.rpm.dataset.manual) row.inputs.rpm.value = rpm ? String(rpm) : "";
      if (!row.inputs.magazine.dataset.manual) row.inputs.magazine.value = magazine ? String(magazine) : "";
      row.inputs.reloadStat.value = reload ? String(reload) : "—";
      row.update();
      afficherStatut(armes.length + " armes du compte chargées. Les perks sont lus depuis tes objets et le manifeste Bungie.", "ready");
    } catch (erreur) {
      if (row.token !== token) return;
      row.weaponMeta.textContent = item.emplacement + " · " + item.lieu + " · Perks installés uniquement (la liste complète est indisponible).";
      const actual = profile.itemComponents && profile.itemComponents.sockets && profile.itemComponents.sockets.data || {};
      const sockets = actual[item.idInstance] && actual[item.idInstance].sockets || [];
      row.perkOptions = [[], []];
      for (let index = 0; index < SLOTS_PERKS.length; index++) {
        const hash = Number(sockets[SLOTS_PERKS[index]] && sockets[SLOTS_PERKS[index]].plugHash) || 0;
        try {
          const perk = hash ? await chargerDefPerk(hash) : null;
          if (perk) row.perkOptions[index] = [Object.assign({ hash: hash }, perk)];
        } catch (_) {}
        remplirPerkSelect(row.perkSelects[index], row.perkOptions[index], hash);
        const selected = row.perkOptions[index][0] || null;
        initialiserDetailPerk(row, index, selected, selected ? bonusConnu(selected, item) : null);
      }
      row.definition = liteDefinitions[item.hash];
      const rpm = statArme(item, row.definition, STATS_ARME.rpm);
      const magazine = statArme(item, row.definition, STATS_ARME.magazine);
      const reload = statArme(item, row.definition, STATS_ARME.recharge);
      if (!row.inputs.rpm.dataset.manual) row.inputs.rpm.value = rpm ? String(rpm) : "";
      if (!row.inputs.magazine.dataset.manual) row.inputs.magazine.value = magazine ? String(magazine) : "";
      row.inputs.reloadStat.value = reload ? String(reload) : "—";
      row.update();
      afficherStatut("Arme chargée; certaines prises de perks n’ont pas pu être lues.", "ready");
    }
  }

  function creerScenario(index) {
    const carte = document.createElement("article");
    carte.className = "scenario-card";
    carte.innerHTML = '<header class="scenario-head"><strong>Scénario ' + index + '</strong><button class="lab-button secondary remove-scenario" type="button">Retirer</button></header>' +
      '<label class="lab-label">Rechercher une arme<input class="scenario-search" type="search" placeholder="Nom, emplacement ou personnage…"></label>' +
      '<label class="lab-label weapon-choice">Arme de ton inventaire<select><option value="">Chargement…</option></select></label>' +
      '<div class="weapon-summary"><div><strong class="weapon-title">Choisis une arme</strong><small class="weapon-meta">Les perks et stats seront chargés automatiquement.</small></div></div>' +
      '<div class="perk-picks">' +
      '<label class="lab-label">Trait · colonne 1<select class="perk-select"><option value="">Chargement…</option></select></label>' +
      '<label class="lab-label">Trait · colonne 2<select class="perk-select"><option value="">Chargement…</option></select></label></div>' +
      '<div class="perk-info-grid">' +
      '<article class="perk-info"><h3>Aucun perk sélectionné</h3><p>Choisis un perk pour voir sa description Bungie.</p><small>Aucun bonus appliqué.</small></article>' +
      '<article class="perk-info"><h3>Aucun perk sélectionné</h3><p>Choisis un perk pour voir sa description Bungie.</p><small>Aucun bonus appliqué.</small></article></div>' +
      '<div class="perk-model"><h3>Impact modélisé des perks</h3>' +
      '<label class="lab-label">Bonus perk 1 (%)<input class="perk-bonus" type="number" step="0.1" value="0"></label>' +
      '<label class="lab-label">Bonus perk 2 (%)<input class="perk-bonus" type="number" step="0.1" value="0"></label>' +
      '<label class="lab-label">Temps actif perk 1 (%)<input class="perk-uptime" type="number" min="0" max="100" step="5" value="100"></label>' +
      '<label class="lab-label">Temps actif perk 2 (%)<input class="perk-uptime" type="number" min="0" max="100" step="5" value="100"></label></div>' +
      '<div class="sim-input-grid">' +
      '<label class="lab-label">Dégâts · corps<input class="sim-input damage-body" type="number" min="0" step="0.1" placeholder="Observés en jeu"></label>' +
      '<label class="lab-label">Dégâts · précision<input class="sim-input damage-crit" type="number" min="0" step="0.1" placeholder="Observés en jeu"></label>' +
      '<label class="lab-label">Tirs de précision (%)<input class="sim-input precision-rate" type="number" min="0" max="100" value="100"></label>' +
      '<label class="lab-label">Cadence · RPM<input class="sim-input stat-rpm" type="number" min="0" step="1" placeholder="Bungie"></label>' +
      '<label class="lab-label">Chargeur<input class="sim-input stat-magazine" type="number" min="0" step="1" placeholder="Bungie"></label>' +
      '<label class="lab-label">Recharge mesurée (s)<input class="sim-input reload-seconds" type="number" min="0" step="0.1" placeholder="Chronomètre"></label>' +
      '<label class="lab-label">Recharge Bungie<input class="reload-stat" type="text" readonly value="—"></label>' +
      '<label class="lab-label">Bonus du build (%)<input class="sim-input build-bonus" type="number" step="0.1" value="0"></label></div>' +
      '<div class="sim-results">' +
      '<div class="sim-result"><span>DPS sans perk · rafale</span><strong class="result-base-burst">—</strong></div>' +
      '<div class="sim-result boosted"><span>DPS avec perks · rafale</span><strong class="result-perk-burst">—</strong></div>' +
      '<div class="sim-result"><span>DPS sans perk · soutenu</span><strong class="result-base-sustained">—</strong></div>' +
      '<div class="sim-result boosted"><span>DPS avec perks · soutenu</span><strong class="result-perk-sustained">—</strong></div>' +
      '</div><p class="sim-note">Entre les dégâts observés sur une cible similaire. La recharge soutenue utilise le temps mesuré en jeu.</p>';

    const row = {
      card: carte,
      token: 0,
      item: null,
      definition: null,
      perkOptions: [[], []],
      weaponSelect: carte.querySelector(".weapon-choice select"),
      search: carte.querySelector(".scenario-search"),
      weaponSummary: carte.querySelector(".weapon-summary"),
      weaponTitle: carte.querySelector(".weapon-title"),
      weaponMeta: carte.querySelector(".weapon-meta"),
      perkSelects: Array.from(carte.querySelectorAll(".perk-select")),
      perkInfo: Array.from(carte.querySelectorAll(".perk-info")),
      perkBonus: Array.from(carte.querySelectorAll(".perk-bonus")),
      perkUptime: Array.from(carte.querySelectorAll(".perk-uptime")),
      inputs: {
        body: carte.querySelector(".damage-body"),
        crit: carte.querySelector(".damage-crit"),
        precision: carte.querySelector(".precision-rate"),
        rpm: carte.querySelector(".stat-rpm"),
        magazine: carte.querySelector(".stat-magazine"),
        reload: carte.querySelector(".reload-seconds"),
        reloadStat: carte.querySelector(".reload-stat"),
        buildBonus: carte.querySelector(".build-bonus")
      },
      results: {
        baseBurst: carte.querySelector(".result-base-burst"),
        perkBurst: carte.querySelector(".result-perk-burst"),
        baseSustained: carte.querySelector(".result-base-sustained"),
        perkSustained: carte.querySelector(".result-perk-sustained")
      },
      update: null
    };

    row.update = function () { calculerScenario(row); };
    remplirSelectArmes(row, "", "");
    row.search.addEventListener("input", function () { remplirSelectArmes(row, row.search.value, row.weaponSelect.value); });
    row.weaponSelect.addEventListener("change", function () { chargerDetailsArme(row, row.weaponSelect.value); });
    row.perkSelects.forEach(function (select, index) {
      select.addEventListener("change", function () {
        const hash = Number(select.value);
        const perk = (row.perkOptions[index] || []).find(function (entry) { return entry.hash === hash; }) || null;
        initialiserDetailPerk(row, index, perk, perk && row.item ? bonusConnu(perk, row.item) : null);
      });
    });
    row.perkBonus.concat(row.perkUptime).forEach(function (input) {
      input.addEventListener("input", row.update);
    });
    Object.keys(row.inputs).forEach(function (key) {
      const input = row.inputs[key];
      if (input && input.classList.contains("sim-input")) {
        input.addEventListener("input", function () {
          if (key === "rpm" || key === "magazine") input.dataset.manual = "true";
          row.update();
        });
      }
    });
    carte.querySelector(".remove-scenario").addEventListener("click", function () {
      if (scenarios.length <= 1) return;
      scenarios = scenarios.filter(function (entry) { return entry !== row; });
      carte.remove();
      scenarios.forEach(function (entry, index) {
        entry.card.querySelector(".scenario-head strong").textContent = "Scénario " + (index + 1);
      });
      el.addScenario.disabled = scenarios.length >= MAX_SCENARIOS;
    });
    scenarios.push(row);
    el.scenarioList.appendChild(carte);
    row.update();
    el.addScenario.disabled = scenarios.length >= MAX_SCENARIOS;
    return row;
  }

  function resultatTexte(value) {
    if (!Number.isFinite(value) || value <= 0) return "—";
    return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " DPS";
  }

  function calculerScenario(row) {
    const corps = nombre(row.inputs.body.value);
    const critique = nombre(row.inputs.crit.value);
    const precision = Math.max(0, Math.min(100, nombre(row.inputs.precision.value))) / 100;
    const rpm = nombre(row.inputs.rpm.value);
    const chargeur = nombre(row.inputs.magazine.value);
    const recharge = nombre(row.inputs.reload.value);
    const bonusBuild = nombre(row.inputs.buildBonus.value);
    if (corps <= 0 || critique <= 0 || rpm <= 0) {
      row.results.baseBurst.textContent = "—";
      row.results.perkBurst.textContent = "—";
      row.results.baseSustained.textContent = "—";
      row.results.perkSustained.textContent = "—";
      return;
    }
    const degatsMoyens = corps * (1 - precision) + critique * precision;
    const multiplicateur = (1 + Math.max(-99, nombre(row.perkBonus[0].value) * nombre(row.perkUptime[0].value) / 100) / 100) *
      (1 + Math.max(-99, nombre(row.perkBonus[1].value) * nombre(row.perkUptime[1].value) / 100) / 100) *
      (1 + Math.max(-99, bonusBuild) / 100);
    const burstBase = degatsMoyens * rpm / 60;
    row.results.baseBurst.textContent = resultatTexte(burstBase);
    row.results.perkBurst.textContent = resultatTexte(burstBase * multiplicateur);
    if (chargeur > 0 && recharge > 0) {
      const tempsCycle = Math.max(0, (chargeur - 1) * 60 / rpm) + recharge;
      row.results.baseSustained.textContent = resultatTexte(chargeur * degatsMoyens / tempsCycle);
      row.results.perkSustained.textContent = resultatTexte(chargeur * degatsMoyens * multiplicateur / tempsCycle);
    } else {
      row.results.baseSustained.textContent = "Recharge à saisir";
      row.results.perkSustained.textContent = "Recharge à saisir";
    }
  }

  function afficherBuild(build) {
    el.buildSummary.replaceChildren();
    if (!build) {
      el.buildSummary.textContent = "Mode libre. Tu peux comparer des armes sans appliquer de bonus personnel enregistré.";
      el.buildWeaponNote.textContent = "Sélectionne une arme de ton inventaire dans chaque scénario.";
      return;
    }
    const pieces = Array.isArray(build.pieces) ? build.pieces : Array.isArray(build.armure) ? build.armure : [];
    const exotiques = pieces.filter(function (piece) { return piece && (piece.exotique || piece.exotic); }).map(function (piece) { return piece.nom || piece.name; }).filter(Boolean);
    const title = document.createElement("strong");
    title.textContent = (build.nom || build.name || "Build sauvegardé") + " · " + (CLASSES[Number(build.classe)] || build.characterName || "Gardien");
    const detail = document.createElement("div");
    detail.textContent = [
      build.doctrine && (build.doctrine.nom || build.doctrine.name),
      exotiques.length ? "Exotique : " + exotiques.join(", ") : "",
      build.bonus && (build.bonus.setName || build.bonus.name) ? "Set : " + (build.bonus.setName || build.bonus.name) : ""
    ].filter(Boolean).join(" · ") || "Aucun exotique ou bonus de set enregistré.";
    el.buildSummary.append(title, detail);
    const stats = document.createElement("div");
    stats.className = "lab-build-stats";
    STATS_AFFICHEES.forEach(function (name, index) {
      const span = document.createElement("span");
      const value = Array.isArray(build.stats) ? nombre(build.stats[index]) : 0;
      span.textContent = name + " " + value;
      stats.appendChild(span);
    });
    el.buildSummary.appendChild(stats);
    el.buildWeaponNote.textContent = "Les armes du build seront préselectionnées si elles sont encore dans ton inventaire. Le bonus de dégâts du build reste réglable dans chaque scénario.";
  }

  function buildsSurAppareil() {
    try {
      const stored = JSON.parse(localStorage.getItem("setsArmures") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch (_) { return []; }
  }

  function remplirBuilds() {
    builds = buildsSurAppareil();
    builds.forEach(function (build, index) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = (build.nom || build.name || "Build " + (index + 1)) + " · " + (CLASSES[Number(build.classe)] || build.characterName || "Gardien");
      el.builds.appendChild(option);
    });
    el.builds.addEventListener("change", function () {
      const build = el.builds.value === "" ? null : builds[Number(el.builds.value)];
      afficherBuild(build);
      if (!build) return;
      const savedWeapons = Array.isArray(build.armes) ? build.armes : Array.isArray(build.weapons) ? build.weapons : [];
      if (!savedWeapons.length) return;
      while (scenarios.length < Math.min(savedWeapons.length, MAX_SCENARIOS)) creerScenario(scenarios.length + 1);
      savedWeapons.slice(0, MAX_SCENARIOS).forEach(function (saved, index) {
        const item = armes.find(function (weapon) {
          return (saved.idInstance && weapon.idInstance === String(saved.idInstance)) ||
            (saved.hash && weapon.hash === Number(saved.hash));
        });
        if (item && scenarios[index]) {
          scenarios[index].search.value = "";
          remplirSelectArmes(scenarios[index], "", item.idInstance);
          scenarios[index].weaponSelect.value = item.idInstance;
          chargerDetailsArme(scenarios[index], item.idInstance);
        }
      });
    });
  }

  async function initialiser() {
    remplirBuilds();
    creerScenario(1);
    el.addScenario.addEventListener("click", function () {
      if (scenarios.length < MAX_SCENARIOS) creerScenario(scenarios.length + 1);
    });

    if (!sessionStorage.getItem("jeton")) {
      afficherStatut("Connecte-toi à Bungie pour lire tes armes et leurs perks. Tes builds locaux sont conservés.", "error");
      el.reconnect.hidden = false;
      return;
    }

    try {
      afficherStatut("Chargement du manifeste et des données de ton compte Bungie…", "");
      const membershipsPromise = membershipsPourCompte();
      const manifest = await appelerBungie("/Destiny2/Manifest/");
      await chargerTableLite(manifest);
      const memberships = await membershipsPromise;
      const liste = memberships.destinyMemberships || [];
      compte = liste.find(function (m) { return m.membershipId === memberships.primaryMembershipId; }) || liste[0];
      if (!compte) throw new Error("Aucun compte Destiny 2 n’est associé à cette connexion.");
      profile = await appelerBungie("/Destiny2/" + compte.membershipType + "/Profile/" + compte.membershipId + "/?components=102,200,201,205,302,304,305");
      chargerArmesDuProfil();
      scenarios.forEach(function (row) { remplirSelectArmes(row, "", ""); });
      afficherStatut(armes.length + " armes trouvées dans tes personnages et ton coffre. Choisis une arme pour charger ses perks.", "ready");
      const selectedBuild = el.builds.value === "" ? null : builds[Number(el.builds.value)];
      if (selectedBuild) {
        const savedWeapons = Array.isArray(selectedBuild.armes) ? selectedBuild.armes : Array.isArray(selectedBuild.weapons) ? selectedBuild.weapons : [];
        savedWeapons.slice(0, MAX_SCENARIOS).forEach(function (saved, index) {
          const item = armes.find(function (weapon) {
            return (saved.idInstance && weapon.idInstance === String(saved.idInstance)) || (saved.hash && weapon.hash === Number(saved.hash));
          });
          if (item && scenarios[index]) {
            remplirSelectArmes(scenarios[index], "", item.idInstance);
            scenarios[index].weaponSelect.value = item.idInstance;
            chargerDetailsArme(scenarios[index], item.idInstance);
          }
        });
      }
    } catch (erreur) {
      afficherStatut("Erreur de chargement : " + (erreur.message || String(erreur)), "error");
      if (/session|connecte|401/i.test(erreur.message || "")) el.reconnect.hidden = false;
    }
  }

  initialiser();
})();
