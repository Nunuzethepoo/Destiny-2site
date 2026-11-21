(function () {
  "use strict";

  const CLASSES = { 0: "Titan", 1: "Chasseur", 2: "Arcaniste" };
  const STATS = ["Mobilité", "Résistance", "Récupération", "Discipline", "Intellect", "Force"];
  const ARMURE = [
    { bucket: 3448274439, nom: "Casque" },
    { bucket: 3551918588, nom: "Gants" },
    { bucket: 14239492, nom: "Torse" },
    { bucket: 20886954, nom: "Jambes" },
    { bucket: 1585787867, nom: "Objet de classe" }
  ];
  const ARMES = [
    { bucket: 1498876634, nom: "Cinétique" },
    { bucket: 2465295065, nom: "Énergie" },
    { bucket: 953998645, nom: "Puissante" }
  ];

  function texte(value, max) {
    return String(value == null ? "" : value).replace(/[<>\u0000-\u001f]/g, "").slice(0, max || 120);
  }

  function icone(value) {
    const path = String(value || "");
    return /^\/common\/destiny2_content\/[A-Za-z0-9_./-]+$/.test(path) && !path.includes("..") ? path : "";
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function emplacements(objets, defs) {
    return defs.map(function (slot) {
      return objets.find(function (objet) {
        return Number(objet.bucketHash) === slot.bucket || objet.emplacement === slot.nom || objet.slot === slot.nom;
      }) || null;
    });
  }

  function preparerBuild(build) {
    build = build && typeof build === "object" ? build : {};
    const pieces = Array.isArray(build.pieces) ? build.pieces : Array.isArray(build.armure) ? build.armure : Array.isArray(build.armor) ? build.armor : [];
    const armes = Array.isArray(build.armes) ? build.armes : Array.isArray(build.weapons) ? build.weapons : [];
    let classe = Number(build.classe !== undefined ? build.classe : build.classId);
    if (![0, 1, 2].includes(classe)) {
      const pieceClasse = pieces.find(function (piece) { return [0, 1, 2].includes(Number(piece.classe)); });
      classe = pieceClasse ? Number(pieceClasse.classe) : 0;
    }
    const stats = Array.isArray(build.stats) ? build.stats.slice(0, 6).map(number) : [];
    const armure = emplacements(pieces, ARMURE).map(function (piece, index) {
      if (!piece) return { slot: ARMURE[index].nom, name: "Aucun équipement", icon: "", exotic: false, stats: [], mods: [] };
      return {
        slot: ARMURE[index].nom,
        name: texte(piece.nom || piece.name || "Équipement", 100),
        icon: icone(piece.icone || piece.icon),
        exotic: Boolean(piece.exotique || piece.exotic),
        total: number(piece.total),
        stats: Array.isArray(piece.stats) ? piece.stats.slice(0, 6).map(number) : [],
        mods: (Array.isArray(piece.mods) ? piece.mods : []).slice(0, 4).map(function (mod) {
          return { name: texte(mod.nom || mod.name || "Mod d’armure", 70), icon: icone(mod.icone || mod.icon) };
        })
      };
    });
    const armesCompactes = emplacements(armes, ARMES).map(function (arme, index) {
      return arme ? {
        slot: ARMES[index].nom,
        name: texte(arme.nom || arme.name || "Arme", 100),
        icon: icone(arme.icone || arme.icon)
      } : { slot: ARMES[index].nom, name: "Aucune arme", icon: "" };
    });
    const doctrineSource = build.doctrine || build.subclass || null;
    const aptitudesSource = doctrineSource && (doctrineSource.aptitudes || doctrineSource.abilities) || [];
    const doctrine = doctrineSource ? {
      name: texte(doctrineSource.nom || doctrineSource.name || "Doctrine", 100),
      icon: icone(doctrineSource.icone || doctrineSource.icon),
      aptitudes: (Array.isArray(aptitudesSource) ? aptitudesSource : []).slice(0, 16).map(function (aptitude) {
        return {
          label: texte(aptitude.label || aptitude.type || "Aptitude", 45),
          name: texte(aptitude.nom || aptitude.name || "Aptitude", 100),
          icon: icone(aptitude.icone || aptitude.icon)
        };
      })
    } : null;
    const bonusSource = build.bonus || null;
    const bonus = bonusSource ? {
      name: texte(bonusSource.setName || bonusSource.name || "Bonus de set", 100),
      count: number(bonusSource.requiredCount || bonusSource.count),
      perks: (Array.isArray(bonusSource.perkNames) ? bonusSource.perkNames : Array.isArray(bonusSource.perks) ? bonusSource.perks : [])
        .slice(0, 4).map(function (perk) { return texte(typeof perk === "string" ? perk : perk.nom || perk.name, 100); })
    } : null;
    return {
      v: 1,
      name: texte(build.nom || build.name || "Build du Gardien", 100),
      classId: classe,
      className: CLASSES[classe] || "Gardien",
      power: number(build.power || build.characterPower),
      stats: stats,
      weapons: armesCompactes,
      armor: armure,
      doctrine: doctrine,
      bonus: bonus
    };
  }

  function base64url(bytes) {
    let binary = "";
    const taille = 0x8000;
    for (let i = 0; i < bytes.length; i += taille) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + taille));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function depuisBase64url(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Le lien de partage est incomplet ou invalide.");
    const normalise = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalise + "=".repeat((4 - normalise.length % 4) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function lireFluxLimite(flux, limite) {
    const reader = flux.getReader();
    const morceaux = [];
    let taille = 0;
    while (true) {
      const resultat = await reader.read();
      if (resultat.done) break;
      taille += resultat.value.length;
      if (taille > limite) {
        await reader.cancel();
        throw new Error("Les données du build dépassent la taille autorisée.");
      }
      morceaux.push(resultat.value);
    }
    const bytes = new Uint8Array(taille);
    let offset = 0;
    for (const morceau of morceaux) {
      bytes.set(morceau, offset);
      offset += morceau.length;
    }
    return bytes;
  }

  async function encoder(build) {
    let bytes = new TextEncoder().encode(JSON.stringify(preparerBuild(build)));
    let prefixe = "j.";
    if (typeof CompressionStream === "function") {
      try {
        const flux = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
        bytes = new Uint8Array(await new Response(flux).arrayBuffer());
        prefixe = "g.";
      } catch (_) {}
    }
    return prefixe + base64url(bytes);
  }

  async function decoder(hash) {
    const valeur = new URLSearchParams(String(hash || "").replace(/^#/, "")).get("b");
    if (!valeur) return null;
    if (valeur.length > 100000) throw new Error("Ce lien de partage est trop volumineux.");
    const prefixe = valeur.slice(0, 2);
    let bytes = depuisBase64url(valeur.slice(2));
    if (bytes.length > 64000) throw new Error("Les données du build dépassent la taille autorisée.");
    if (prefixe === "g.") {
      if (typeof DecompressionStream !== "function") throw new Error("Ce navigateur ne peut pas ouvrir le lien compressé. Essaie un navigateur récent.");
      const flux = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      bytes = await lireFluxLimite(flux, 64000);
    } else if (prefixe !== "j.") {
      throw new Error("La version de ce lien de partage n’est pas reconnue.");
    }
    if (bytes.length > 64000) throw new Error("Les données du build dépassent la taille autorisée.");
    const build = JSON.parse(new TextDecoder().decode(bytes));
    if (!build || build.v !== 1) throw new Error("Le contenu du build n’est pas reconnu.");
    return preparerBuild(build);
  }

  function lireBuildsLocaux() {
    try {
      const builds = JSON.parse(localStorage.getItem("setsArmures") || "[]");
      return Array.isArray(builds) ? builds : [];
    } catch (_) {
      return [];
    }
  }

  function image(path, className, alt) {
    const url = icone(path);
    if (!url) return null;
    const img = document.createElement("img");
    img.className = className || "";
    img.src = "https://www.bungie.net" + url;
    img.alt = alt || "";
    img.loading = "lazy";
    return img;
  }

  function creerTuile(item, type) {
    const tile = document.createElement("article");
    tile.className = "shared-gear-tile" + (item.exotic ? " is-exotic" : "") + (type === "weapon" ? " is-weapon" : " is-armor");
    const thumb = document.createElement("div");
    thumb.className = "shared-gear-icon";
    const img = image(item.icon, "", item.name);
    if (img) thumb.appendChild(img);
    else {
      const glyph = document.createElement("span");
      glyph.textContent = type === "weapon" ? "✦" : "◇";
      thumb.appendChild(glyph);
    }
    const slot = document.createElement("span");
    slot.className = "shared-gear-slot";
    slot.textContent = item.slot + (item.exotic ? " · EXO" : "");
    const name = document.createElement("strong");
    name.className = "shared-gear-name";
    name.textContent = item.name;
    tile.append(thumb, slot, name);
    if (type === "armor" && item.mods && item.mods.length) {
      const mods = document.createElement("div");
      mods.className = "shared-mod-list";
      item.mods.forEach(function (mod) {
        const chip = document.createElement("span");
        chip.className = "shared-mod-chip";
        chip.textContent = mod.name;
        chip.title = mod.name;
        mods.appendChild(chip);
      });
      tile.appendChild(mods);
    }
    return tile;
  }

  function rendreBuild(build, options) {
    const opts = options || {};
    const card = document.createElement("article");
    card.className = "shared-build-card";
    const header = document.createElement("header");
    header.className = "shared-build-head";
    const titleZone = document.createElement("div");
    const tag = document.createElement("span");
    tag.className = "shared-class-tag";
    tag.textContent = build.className;
    const title = document.createElement("h2");
    title.textContent = build.name;
    const sub = document.createElement("p");
    sub.className = "shared-subtitle";
    sub.textContent = (build.doctrine ? build.doctrine.name : "Doctrine non renseignée") + " · " + build.className;
    titleZone.append(tag, title, sub);
    const power = document.createElement("span");
    power.className = "shared-power";
    power.textContent = build.power ? "PUISSANCE " + build.power : "BUILD VIGIE";
    header.append(titleZone, power);
    card.appendChild(header);

    const equipment = document.createElement("section");
    equipment.className = "shared-equipment";
    equipment.setAttribute("aria-label", "Équipement complet du build");
    build.weapons.forEach(function (item) { equipment.appendChild(creerTuile(item, "weapon")); });
    build.armor.forEach(function (item) { equipment.appendChild(creerTuile(item, "armor")); });
    card.appendChild(equipment);

    const statSection = document.createElement("section");
    statSection.className = "shared-stat-section";
    const statTitle = document.createElement("h3");
    statTitle.textContent = "Stats du build";
    statSection.appendChild(statTitle);
    const statGrid = document.createElement("div");
    statGrid.className = "shared-stat-grid";
    STATS.forEach(function (name, index) {
      const value = number(build.stats[index]);
      const cell = document.createElement("div");
      cell.className = "shared-stat-cell";
      const label = document.createElement("span");
      label.textContent = name;
      const amount = document.createElement("strong");
      amount.textContent = String(value);
      const tier = document.createElement("small");
      tier.textContent = "PALIER " + Math.floor(value / 10);
      cell.append(label, amount, tier);
      statGrid.appendChild(cell);
    });
    statSection.appendChild(statGrid);

    const lower = document.createElement("div");
    lower.className = "shared-build-lower";
    const doctrine = document.createElement("section");
    doctrine.className = "shared-info-panel shared-doctrine-panel";
    const doctrineTitle = document.createElement("h3");
    doctrineTitle.textContent = "Doctrine et aptitudes";
    doctrine.appendChild(doctrineTitle);
    if (build.doctrine) {
      const doctrineHead = document.createElement("div");
      doctrineHead.className = "shared-doctrine-head";
      const doctrineImg = image(build.doctrine.icon, "", "");
      if (doctrineImg) doctrineHead.appendChild(doctrineImg);
      const doctrineName = document.createElement("strong");
      doctrineName.textContent = build.doctrine.name;
      doctrineHead.appendChild(doctrineName);
      doctrine.appendChild(doctrineHead);
      const abilities = document.createElement("div");
      abilities.className = "shared-abilities";
      build.doctrine.aptitudes.forEach(function (aptitude) {
        const item = document.createElement("div");
        item.className = "shared-ability";
        const abilityImg = image(aptitude.icon, "", "");
        if (abilityImg) item.appendChild(abilityImg);
        const desc = document.createElement("span");
        const kind = document.createElement("small");
        kind.textContent = aptitude.label;
        const abilityName = document.createElement("strong");
        abilityName.textContent = aptitude.name;
        desc.append(kind, abilityName);
        item.appendChild(desc);
        abilities.appendChild(item);
      });
      if (!build.doctrine.aptitudes.length) {
        const empty = document.createElement("p");
        empty.className = "shared-empty-note";
        empty.textContent = "Aucune aptitude enregistrée dans ce build.";
        abilities.appendChild(empty);
      }
      doctrine.appendChild(abilities);
    } else {
      const empty = document.createElement("p");
      empty.className = "shared-empty-note";
      empty.textContent = "Aucune doctrine enregistrée.";
      doctrine.appendChild(empty);
    }
    lower.appendChild(doctrine);

    const bonusPanel = document.createElement("section");
    bonusPanel.className = "shared-info-panel shared-bonus-panel";
    const bonusTitle = document.createElement("h3");
    bonusTitle.textContent = "Bonus d’armure";
    bonusPanel.appendChild(bonusTitle);
    if (build.bonus) {
      const bonusName = document.createElement("strong");
      bonusName.className = "shared-bonus-name";
      bonusName.textContent = build.bonus.name + (build.bonus.count ? " · " + build.bonus.count + " pièces" : "");
      bonusPanel.appendChild(bonusName);
      if (build.bonus.perks.length) {
        const perks = document.createElement("ul");
        perks.className = "shared-perks";
        build.bonus.perks.forEach(function (name) {
          const perk = document.createElement("li");
          perk.textContent = name;
          perks.appendChild(perk);
        });
        bonusPanel.appendChild(perks);
      }
    } else {
      const empty = document.createElement("p");
      empty.className = "shared-empty-note";
      empty.textContent = "Aucun bonus de set sélectionné.";
      bonusPanel.appendChild(empty);
    }
    lower.appendChild(bonusPanel);
    card.append(statSection, lower);

    if (opts.shareButton) {
      const actions = document.createElement("div");
      actions.className = "shared-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copier le lien de partage";
      const status = document.createElement("span");
      status.className = "shared-copy-status";
      button.addEventListener("click", async function () {
        button.disabled = true;
        status.textContent = "Préparation du lien…";
        try {
          const url = await creerLien(build);
          await copier(url);
          status.textContent = "Lien copié. Envoie-le à la personne avec qui tu veux partager ce build.";
        } catch (erreur) {
          status.textContent = erreur.message || "Impossible de copier le lien.";
        } finally {
          button.disabled = false;
        }
      });
      actions.append(button, status);
      card.appendChild(actions);
    }
    return card;
  }

  async function creerLien(build) {
    const encodage = await encoder(build);
    const url = new URL("partager.html", location.href);
    url.hash = "b=" + encodage;
    return url.toString();
  }

  async function copier(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const champ = document.createElement("textarea");
    champ.value = value;
    champ.style.position = "fixed";
    champ.style.opacity = "0";
    document.body.appendChild(champ);
    champ.select();
    const copie = document.execCommand("copy");
    champ.remove();
    if (!copie) window.prompt("Copie ce lien de partage :", value);
  }

  async function initialiser() {
    const sectionPartage = document.getElementById("buildPartage");
    const listeBuilds = document.getElementById("buildsLocaux");
    const message = document.getElementById("partageMessage");
    const lien = new URLSearchParams(location.hash.replace(/^#/, "")).get("b");
    if (lien) {
      try {
        const build = await decoder(location.hash);
        sectionPartage.appendChild(rendreBuild(build, { shareButton: true }));
        document.getElementById("partageIntro").textContent = "Fiche de build autonome : équipement, stats, doctrine, aptitudes et bonus de set.";
      } catch (erreur) {
        message.hidden = false;
        message.textContent = erreur.message || "Ce lien de partage ne peut pas être ouvert.";
      }
    }
    const builds = lireBuildsLocaux();
    if (!builds.length) {
      const empty = document.createElement("p");
      empty.className = "shared-empty-card";
      empty.textContent = "Les builds enregistrés sur cet appareil apparaîtront ici. Crée et sauvegarde un build depuis le générateur pour obtenir son lien de partage.";
      listeBuilds.appendChild(empty);
      return;
    }
    builds.slice().reverse().forEach(function (build) {
      listeBuilds.appendChild(rendreBuild(preparerBuild(build), { shareButton: true }));
    });
  }

  window.VIGIE_PARTAGE = { initialiser: initialiser };
})();
