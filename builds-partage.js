(function () {
  "use strict";

  const CLASSES = { 0: "Titan", 1: "Chasseur", 2: "Arcaniste" };
  // Même ordre que STATS_ARMURE du générateur : les anciennes positions sont converties vers Armor 3.0.
  const STATS = ["Armes", "Santé", "Classe", "Grenade", "Super", "Mêlée"];
  const MAX_STAT = 200;
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

  const CLE_BUILDS_PARTAGES = "vigieBuildsPartagesV1";

  function lireBuildsPartages() {
    try {
      const builds = JSON.parse(localStorage.getItem(CLE_BUILDS_PARTAGES) || "[]");
      return Array.isArray(builds) ? builds.filter(function (item) {
        return item && typeof item.id === "string" && item.build && typeof item.build === "object";
      }) : [];
    } catch (_) {
      return [];
    }
  }

  function signatureBuild(build) {
    return JSON.stringify(preparerBuild(build));
  }

  function ajouterBuildPartage(build) {
    const builds = lireBuildsPartages();
    const signature = signatureBuild(build);
    const dejaPartage = builds.some(function (item) {
      return signatureBuild(item.build) === signature;
    });
    if (dejaPartage) return false;
    builds.push({
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      build: preparerBuild(build)
    });
    localStorage.setItem(CLE_BUILDS_PARTAGES, JSON.stringify(builds));
    return true;
  }

  function retirerBuildPartage(id) {
    const builds = lireBuildsPartages().filter(function (item) { return item.id !== id; });
    localStorage.setItem(CLE_BUILDS_PARTAGES, JSON.stringify(builds));
  }

  function afficherBuildsPartages() {
    const liste = document.getElementById("buildsPartages");
    if (!liste) return;
    while (liste.firstChild) liste.removeChild(liste.firstChild);
    const builds = lireBuildsPartages();
    if (!builds.length) {
      const empty = document.createElement("p");
      empty.className = "shared-empty-card";
      empty.textContent = "Aucun build n’est partagé pour le moment. Choisis un build sauvegardé ci-dessous et clique sur « Partager ce build ».";
      liste.appendChild(empty);
      return;
    }
    builds.slice().reverse().forEach(function (item) {
      liste.appendChild(rendreBuild(preparerBuild(item.build), {
        shareButton: true,
        preview: true,
        removeSharedId: item.id
      }));
    });
  }

  function creerImageSynthese(build) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 675;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const couleurClasse = ["#d98168", "#78c1d8", "#d5b56c"][Number(build.classId)] || "#8bd8dc";
    const fond = ctx.createLinearGradient(0, 0, 1200, 675);
    fond.addColorStop(0, "#1b2834"); fond.addColorStop(0.55, "#101820"); fond.addColorStop(1, "#090e13");
    ctx.fillStyle = fond; ctx.fillRect(0, 0, 1200, 675);
    ctx.fillStyle = "#0b1117"; ctx.fillRect(12, 12, 1176, 651);
    ctx.strokeStyle = "#8bd8dc70"; ctx.strokeRect(12.5, 12.5, 1175, 650);
    ctx.textBaseline = "top";
    function texte(value, x, y, font, color, largeur) {
      ctx.font = font; ctx.fillStyle = color;
      ctx.fillText(String(value == null ? "" : value), x, y, largeur);
    }
    ctx.fillStyle = "#8bd8dc"; ctx.fillRect(48, 44, 5, 95);
    texte("VIGIE  /  BUILD DU GARDIEN", 68, 41, "700 17px Arial", "#8bd8dc", 720);
    ctx.fillStyle = couleurClasse; ctx.fillRect(68, 72, 150, 27);
    texte(build.className.toUpperCase(), 78, 78, "700 14px Arial", "#10161c", 132);
    texte(build.name || "Build du Gardien", 68, 109, "700 42px Arial", "#f1f4f7", 820);
    texte((build.doctrine ? build.doctrine.name : "Doctrine non renseignée") + "  ·  " + build.className, 68, 161, "600 19px Arial", "#aebbc7", 810);
    ctx.fillStyle = "#111a22"; ctx.fillRect(980, 45, 164, 92);
    ctx.strokeStyle = "#c99f5b99"; ctx.strokeRect(980.5, 45.5, 163, 91);
    texte("PUISSANCE", 997, 59, "700 12px Arial", "#c99f5b", 130);
    texte(build.power ? String(build.power) : "VIGIE", 997, 83, "700 30px Arial", "#f0dfbd", 130);

    texte("ÉQUIPEMENT", 48, 207, "700 14px Arial", "#c99f5b", 690);
    const equipements = (build.weapons || []).concat(build.armor || []);
    const largeurCarte = 224, hauteurCarte = 96, espace = 10;
    equipements.slice(0, 8).forEach(function (item, index) {
      const colonne = index % 3, ligne = Math.floor(index / 3);
      const x = 48 + colonne * (largeurCarte + espace), y = 235 + ligne * (hauteurCarte + 10);
      ctx.fillStyle = "#111a22"; ctx.fillRect(x, y, largeurCarte, hauteurCarte);
      ctx.strokeStyle = item.exotic ? "#d5a748" : "#526171";
      ctx.strokeRect(x + 0.5, y + 0.5, largeurCarte - 1, hauteurCarte - 1);
      ctx.fillStyle = item.exotic ? "#d5a748" : "#8bd8dc"; ctx.fillRect(x, y, 3, hauteurCarte);
      texte(String(item.slot || "Équipement").toUpperCase() + (item.exotic ? "  ·  EXO" : ""), x + 12, y + 12, "700 10px Arial", "#9aaab7", largeurCarte - 23);
      texte(item.name || "Aucun équipement", x + 12, y + 37, "700 16px Arial", "#edf1f4", largeurCarte - 23);
    });

    texte("STATS", 774, 207, "700 14px Arial", "#c99f5b", 370);
    STATS.forEach(function (nom, index) {
      const y = 235 + index * 53, valeur = number((build.stats || [])[index]);
      texte(nom.toUpperCase(), 774, y, "700 11px Arial", "#b5c0ca", 130);
      ctx.fillStyle = "#25313c"; ctx.fillRect(904, y + 2, 175, 10);
      ctx.fillStyle = couleurClasse; ctx.fillRect(904, y + 2, 175 * Math.max(0, Math.min(MAX_STAT, valeur)) / MAX_STAT, 10);
      ctx.strokeStyle = "#d5a748"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(991.5, y + 1); ctx.lineTo(991.5, y + 13); ctx.stroke();
      texte(String(valeur), 1092, y - 5, "700 22px Arial", "#f0d8a6", 52);
      texte(valeur > 100 ? "RENFORCÉ" : "BASE", 1092, y + 21, "600 9px Arial", "#7f8d9a", 64);
    });
    const bonus = build.bonus ? build.bonus.name + (build.bonus.count ? " · " + build.bonus.count + " pièces" : "") : "Aucun bonus de set sélectionné";
    ctx.strokeStyle = "#ffffff22"; ctx.beginPath(); ctx.moveTo(48, 566); ctx.lineTo(1144, 566); ctx.stroke();
    texte("BONUS DE SET", 48, 584, "700 11px Arial", "#c99f5b", 130);
    texte(bonus, 162, 580, "600 15px Arial", "#d9e1e8", 650);
    texte("IMAGE CLIQUABLE · FICHE DÉTAILLÉE", 842, 585, "700 11px Arial", "#8bd8dc", 302);
    try { return canvas.toDataURL("image/png"); } catch (_) { return ""; }
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
      tier.textContent = value > 100 ? "RENFORCÉ · 101–200" : "BASE · 0–100";
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

    if (opts.shareButton || opts.publishButton || opts.removeSharedId) {
      const actions = document.createElement("div");
      actions.className = "shared-actions";
      const status = document.createElement("span");
      status.className = "shared-copy-status";

      if (opts.shareButton || opts.publishButton) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = opts.publishButton ? "Partager ce build" : "Copier le lien de partage";
        button.addEventListener("click", async function () {
          button.disabled = true;
          status.textContent = "Préparation du lien…";
          try {
            const url = await creerLien(build);
            await copier(url);
            if (opts.publishButton) {
              const ajoute = ajouterBuildPartage(build);
              status.textContent = ajoute
                ? "Build ajouté à « Mes builds partagés » et lien copié. Envoie-le à la personne de ton choix."
                : "Ce build est déjà dans « Mes builds partagés » ; son lien a été copié.";
              afficherBuildsPartages();
            } else {
              status.textContent = "Lien copié. Envoie-le à la personne avec qui tu veux partager ce build.";
            }
          } catch (erreur) {
            status.textContent = erreur.message || "Impossible de préparer le partage.";
          } finally {
            button.disabled = false;
          }
        });
        actions.appendChild(button);
      }

      if (opts.removeSharedId) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "secondary";
        remove.textContent = "Retirer de mes partages";
        remove.addEventListener("click", function () {
          retirerBuildPartage(opts.removeSharedId);
          afficherBuildsPartages();
        });
        actions.appendChild(remove);
      }

      actions.appendChild(status);
      card.appendChild(actions);
    }

    if (opts.preview) {
      const synthese = creerImageSynthese(build);
      const entree = document.createElement("div");
      entree.className = "shared-build-entry";
      const apercu = document.createElement("button");
      apercu.type = "button"; apercu.className = "shared-build-preview";
      apercu.setAttribute("aria-expanded", "false");
      apercu.setAttribute("aria-label", "Afficher les détails du build " + build.name);
      if (synthese) {
        const imageApercu = document.createElement("img");
        imageApercu.src = synthese;
        imageApercu.alt = "Synthèse visuelle de " + build.name + ". Clique pour afficher le build complet.";
        imageApercu.loading = "lazy";
        apercu.appendChild(imageApercu);
      }
      const indice = document.createElement("span");
      indice.className = "shared-preview-hint";
      indice.textContent = "Cliquer pour afficher les détails";
      apercu.appendChild(indice);
      apercu.addEventListener("click", function () {
        card.hidden = !card.hidden;
        const ouvert = !card.hidden;
        apercu.setAttribute("aria-expanded", String(ouvert));
        indice.textContent = ouvert ? "Cliquer pour masquer les détails" : "Cliquer pour afficher les détails";
        if (ouvert) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      entree.appendChild(apercu);
      if (synthese) {
        const telecharger = document.createElement("a");
        const nomFichier = String(build.name || "build").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "build";
        telecharger.className = "shared-image-download";
        telecharger.href = synthese;
        telecharger.download = "VIGIE-" + nomFichier + ".png";
        telecharger.textContent = "Télécharger l’image PNG";
        entree.appendChild(telecharger);
      }
      card.hidden = true;
      entree.appendChild(card);
      return entree;
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
        sectionPartage.appendChild(rendreBuild(build, { shareButton: true, preview: true }));
        document.getElementById("partageIntro").textContent = "Fiche de build autonome : équipement, stats, doctrine, aptitudes et bonus de set.";
      } catch (erreur) {
        message.hidden = false;
        message.textContent = erreur.message || "Ce lien de partage ne peut pas être ouvert.";
      }
    }

    afficherBuildsPartages();
    const builds = lireBuildsLocaux();
    if (!builds.length) {
      const empty = document.createElement("p");
      empty.className = "shared-empty-card";
      empty.textContent = "Aucun build sauvegardé sur cet appareil. Crée et sauvegarde un build dans le générateur ; il restera privé jusqu’à ce que tu choisisses « Partager ce build ».";
      listeBuilds.appendChild(empty);
      return;
    }
    builds.slice().reverse().forEach(function (build) {
      listeBuilds.appendChild(rendreBuild(preparerBuild(build), { publishButton: true }));
    });
  }

  window.VIGIE_PARTAGE = { initialiser: initialiser };
})();
