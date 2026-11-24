/**
 * VIGIE's Bungie API relay for Cloudflare Workers.
 * Secrets: BUNGIE_API_KEY, BUNGIE_CLIENT_ID. Variable: SITE_ORIGIN.
 */
const API = "https://www.bungie.net/Platform";

// Captures de donjons autorisées : le proxy ne peut pas charger d'URL arbitraire.
const IMAGE_URLS = new Set(["https://gameranx.com/wp-content/uploads/2018/09/Destiny-2_20180925222050.jpg","https://d1lss44hh2trtw.cloudfront.net/assets/editorial/2018/09/destiny-2-shattered-throne-dungeon-vorgeth.jpg","https://cdn.mos.cms.futurecdn.net/KBfQKxhBX339HE97uVnj3W-1200-80.jpg","https://media.dotesports.com/wp-content/uploads/2025/09/destiny-2-necropolis.jpg","https://images.mein-mmo.de/magazin/medien/2019/10/T%C3%BCr-Grube-der-ketzerei-destiny-2.jpg","https://www.paracausality.com/assets/img/guides/POH/pit-of-heresy-chamber-of-suffering-destiny-2.jpg","https://shacknews-www.s3.amazonaws.com/assets/editorial/2019/11/pit-of-heresy-the-harrow-destiny-2.jpg","https://www.novarcan.com/jeux/destiny-2/donjons/fosse-de-l-heresie/zulmak/zulmak-devant-le-cristal.jpg","https://d1lss44hh2trtw.cloudfront.net/assets/editorial/2020/06/destiny-2-prophecy-dungeon-phalanx-echo.jpg","https://www.novarcan.com/jeux/destiny-2/donjons/prophetie/l-hexaedre/hexaedre-boss.jpg","https://cdn.vox-cdn.com/uploads/chorus_asset/file/20032016/D2_PC_Osiris2020_06_12_11h22m33s707.png","https://shacknews-www.s3.amazonaws.com/assets/editorial/2021/12/destiny-2-grasp-of-avarice-phry-zhia-the-insatiable.jpg","https://staticg.sportskeeda.com/editor/2021/12/dbc0c-16391732591402-1920.jpg","https://shacknews-www.s3.amazonaws.com/assets/editorial/2021/12/destiny-2-grasp-of-avarice-captain-avarokk-engrams.jpg","https://staticg.sportskeeda.com/editor/2022/05/8e77f-16536975717304-1920.jpg","https://kboosting.com/media/images/guide/165/second-encounter-two.jpg","https://cdn.mos.cms.futurecdn.net/DmMrhh9rmPgYaXvW8KcCxH.jpg","https://d1lss44hh2trtw.cloudfront.net/assets/editorial/2022/12/destiny-2-spire-of-the-watcher-reestablish-power-nodes.jpg","https://staticg.sportskeeda.com/editor/2022/12/00615-16706365484857-1920.jpg","https://staticg.sportskeeda.com/editor/2022/12/07a89-16706875529329-1920.jpg","https://grindout.com/storage/guide-images/154/first-encounter-statue.jpg","https://static.fanbyte.com/uploads/2023/07/ghosts%20of%20the%20deep%20ecthar%20encounter_statue_destiny%202_fanbyte.jpg","https://static.fanbyte.com/uploads/2023/07/ghosts%20of%20the%20deep_simmumah%20encounter_ghost%20symbol_destiny%202_fanbyte.jpg","https://kboosting.com/media/images/guide/84/destiny-2-warlord-s-ruin-rathil-taken-totem.jpg","https://skycoach.gg/storage/uploads/products/description/product_656acb20eb84d.png","https://estnn.com/app/uploads/2023/12/Destiny-2-Hefnd-3.webp","https://cdn.mos.cms.futurecdn.net/TPJYPBewTrCaqnD8YhR6fK-970-80.jpg","https://shacknews-www.s3.amazonaws.com/assets/editorial/2024/10/destiny-2-vespers-host-raneiks-unified-servitor-numbers.jpg","https://staticg.sportskeeda.com/editor/2024/10/3e402-17290612991813-1920.jpg","https://staticg.sportskeeda.com/editor/2025/02/2b0aa-17389635223982-1920.jpg","https://static.deltiasgaming.com/2025/02/Destiny-2-Sundered-Doctrine-How-To-Complete-Second-Encounter-and-Defeat-Zoetic-Lockset.jpg","https://static.deltiasgaming.com/2025/02/Destiny-2-Sundered-Doctrine-How-To-Complete-Boss-Encounter-and-Defeat-Kerrev-the-Erased-768x432.jpg","https://totalapexgaming.com/wp-content/uploads/2025/12/Harvester-Ship-1_11zon.webp","https://shacknews-www.s3.amazonaws.com/assets/editorial/2025/12/destiny-2-equilibrium-second-encounter-floor-drop.jpg","https://shacknews-www.s3.amazonaws.com/assets/editorial/2025/12/destiny-2-equilibrium-final-encounter-dredgen-sere.jpg"]);
const IMAGE_REFERENCES = new Set(["https://gameranx.com/features/id/162394/article/destiny-2-forsaken-how-to-play-the-shattered-throne-a-secret-mission-with-powerful-engrams-secrets-guide/","https://www.shacknews.com/article/107607/shattered-throne-dungeon-guide-destiny-2","https://www.pcgamer.com/destiny-2-shattered-throne-map/","https://dotesports.com/destiny/news/how-to-complete-beneath-the-necropolis-in-destiny-2","https://mein-mmo.de/en/destiny-2-pit-of-heresy-how-to-master-the-new-dungeon-in-shadowkeep%2C438232/","https://www.paracausality.com/poh_guide","https://www.shacknews.com/article/114869/pit-of-heresy-guide-destiny-2","https://www.novarcan.com/jeux/destiny-2/donjons/fosse-de-l-heresie/zulmak/","https://www.shacknews.com/article/118838/prophecy-dungeon-guide-destiny-2","https://www.novarcan.com/jeux/destiny-2/donjons/prophetie/l-hexaedre/","https://www.polygon.com/destiny-2-guide-walkthrough/2020/6/12/21287108/prophecy-dungeon-season-arrivals-encounter-boss-puzzle-kell-echo-centurion-phalanx","https://www.shacknews.com/article/128012/grasp-of-avarice-dungeon-guide-destiny-2","https://www.sportskeeda.com/esports/all-grasp-avarice-audio-logs-destiny-2-wilhelm-7-message-locations-guide","https://www.sportskeeda.com/esports/destiny-2-duality-dungeon-guide-nightmare-gahlran-boss-fight","https://kboosting.com/destiny-2/guides/duality","https://www.gamesradar.com/destiny-2-duality-dungeon-guide/","https://www.shacknews.com/article/133423/spire-of-the-watcher-guide","https://www.sportskeeda.com/esports/destiny-2-spire-watcher-guide-akelous-the-siren-s-current-boss-encounter","https://www.sportskeeda.com/esports/destiny-2-spire-watcher-guide-persys-primordial-ruin-boss-descend-encounter","https://grindout.com/destiny-2/guides/ghosts-of-the-deep","https://www.fanbyte.com/destiny-2/guides/destiny-2-ghosts-of-the-deep-dungeon-guide-ecthar-encounter","https://www.fanbyte.com/destiny-2/guides/destiny-2-ghosts-of-the-deep-dungeon-guide-simmumah-boss-fight","https://kboosting.com/destiny-2/guides/warlords-ruin-dungeon","https://skycoach.gg/blog/destiny/articles/destiny-2-warlords-ruin-dungeon-guide","https://estnn.com/destiny-2-hefnd-boss-guide/","https://www.screenhacker.com/how-to-complete-the-destiny-2-vespers-host-dungeon/","https://www.shacknews.com/article/141768/destiny-2-vespers-host-guide","https://www.sportskeeda.com/mmo/destiny-2-vesper-s-host-boss-encounter-guide-the-corrupted-puppeteer","https://www.sportskeeda.com/mmo/destiny-2-sundered-doctrine-dungeon-first-encounter-guide","https://deltiasgaming.com/destiny-2-sundered-doctrine-how-to-complete-second-encounter-and-defeat-zoetic-lockset/","https://deltiasgaming.com/destiny-2-sundered-doctrine-how-to-complete-boss-encounter-and-defeat-kerrev-the-erased/","https://www.yardbarker.com/video_games/articles/equilibrium_dungeon_boarding_the_harvester_1st_encounter_guide/s1_17458_43204435","https://www.shacknews.com/article/147168/how-to-complete-the-equilibrium-dungeon-in-destiny-2"]);


function reply(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type",
      "vary": "Origin"
    }
  });
}

function fail(message, status, origin) {
  return reply({ error: message }, status, origin);
}


function emptyGuideData() {
  return { version: 1, raids: {}, dungeons: {}, dungeonMeta: {} };
}

function cleanGuideText(value) {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, 20000);
}

function cleanGuideBucket(source) {
  const result = Object.create(null);
  if (!source || typeof source !== "object" || Array.isArray(source)) return result;
  for (const [id, record] of Object.entries(source).slice(0, 500)) {
    if (!id || id.length > 120 || /[<>\u0000-\u001F]/.test(id) || ["__proto__", "prototype", "constructor"].includes(id)) continue;
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    const fields = Object.create(null);
    if (record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)) {
      for (const [field, value] of Object.entries(record.fields).slice(0, 40)) {
        if (!/^[A-Za-z0-9_-]{1,60}$/.test(field) || typeof value !== "string") continue;
        fields[field] = cleanGuideText(value);
      }
    }
    const rawUrls = Array.isArray(record.mapUrls) ? record.mapUrls : (typeof record.mapUrl === "string" && record.mapUrl ? [record.mapUrl] : []);
    const mapUrls = [];
    for (const rawUrl of rawUrls.slice(0, 6)) {
      if (typeof rawUrl !== "string" || rawUrl.length > 2048) continue;
      try {
        const parsed = new URL(rawUrl);
        if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname && !parsed.username && !parsed.password) {
          mapUrls.push(parsed.toString());
        }
      } catch (_) {}
    }
    result[id] = { fields, mapUrls };
  }
  return result;
}

function cleanGuideData(input) {
  if (!input || typeof input !== "object" || input.version !== 1) return null;
  return {
    version: 1,
    raids: cleanGuideBucket(input.raids),
    dungeons: cleanGuideBucket(input.dungeons),
    dungeonMeta: cleanGuideBucket(input.dungeonMeta)
  };
}

async function handleSharedGuides(request, env, siteOrigin) {
  if (!env.VIGIE_GUIDES) return fail("La sauvegarde partagée des guides n’est pas configurée", 503, siteOrigin);
  const key = "shared-guides-v1";
  if (request.method === "GET") {
    const raw = await env.VIGIE_GUIDES.get(key);
    if (!raw) return reply({ edits: emptyGuideData(), updatedAt: null }, 200, siteOrigin);
    try {
      const saved = JSON.parse(raw);
      return reply({ edits: cleanGuideData(saved.edits) || emptyGuideData(), updatedAt: saved.updatedAt || null }, 200, siteOrigin);
    } catch (_) {
      return fail("La sauvegarde partagée des guides est illisible", 500, siteOrigin);
    }
  }
  if (request.method !== "PUT") return fail("Méthode non autorisée", 405, siteOrigin);
  if (!env.BUNGIE_API_KEY || !env.VIGIE_GUIDE_EDITOR_ID) return fail("La publication des guides n’est pas configurée", 503, siteOrigin);
  const authorization = request.headers.get("Authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  if (!bearer || bearer[1].length > 5000) return fail("Connecte-toi à Bungie pour publier les guides", 401, siteOrigin);

  const identityResponse = await fetch(API + "/User/GetMembershipsForCurrentUser/", {
    headers: { "X-API-Key": env.BUNGIE_API_KEY, "Authorization": "Bearer " + bearer[1], "Accept": "application/json" }
  });
  if (!identityResponse.ok) return fail("La session Bungie a expiré. Reconnecte-toi puis réessaie.", 401, siteOrigin);
  let identity;
  try { identity = await identityResponse.json(); } catch (_) { return fail("Bungie n’a pas retourné un profil valide", 502, siteOrigin); }
  const editorId = String(identity && identity.Response && identity.Response.bungieNetUser && identity.Response.bungieNetUser.membershipId || "");
  if (!editorId || editorId !== String(env.VIGIE_GUIDE_EDITOR_ID)) return fail("Ce compte Bungie n’est pas autorisé à publier les guides", 403, siteOrigin);

  const raw = await request.text();
  if (raw.length > 1000000) return fail("La sauvegarde dépasse la taille maximale autorisée", 413, siteOrigin);
  let incoming;
  try { incoming = JSON.parse(raw); } catch (_) { return fail("Le contenu des guides n’est pas un JSON valide", 400, siteOrigin); }
  const edits = cleanGuideData(incoming);
  if (!edits) return fail("Le format des guides n’est pas reconnu", 400, siteOrigin);
  const updatedAt = new Date().toISOString();
  await env.VIGIE_GUIDES.put(key, JSON.stringify({ edits, updatedAt }));
  return reply({ ok: true, updatedAt }, 200, siteOrigin);
}

function allowedPath(path, method) {
  if (path.startsWith("/common/destiny2_content/json/")) return method === "GET";
  if (!path.startsWith("/Platform/")) return false;
  if (method === "GET") {
    return path.startsWith("/Platform/Destiny2/") ||
      path.startsWith("/Platform/User/GetMembershipsForCurrentUser/") ||
      path.startsWith("/Platform/User/GetMembershipsById/") ||
      /^\/Platform\/GroupV2\/User\/\d+\/\d+\/\d+\/\d+\/$/.test(path.split("?")[0]) ||
      /^\/Platform\/GroupV2\/\d+\/Members\/$/.test(path.split("?")[0]);
  }
  return method === "POST" && /^\/Platform\/Destiny2\/Actions\/Items\/(TransferItem|EquipItem|EquipItems|InsertSocketPlugFree)\/$/.test(path);
}


async function proxyDungeonImage(request, url, siteOrigin) {
  const headers = {
    "cache-control": "no-store",
    "access-control-allow-origin": siteOrigin || "null",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "vary": "Origin"
  };
  const failImage = (message, status) => new Response(message, {
    status,
    headers: { ...headers, "content-type": "text/plain; charset=utf-8" }
  });
  if (request.method !== "GET") return failImage("Méthode non autorisée", 405);
  let refererOrigin = "";
  try { refererOrigin = new URL(request.headers.get("Referer") || "").origin; } catch {}
  if (!siteOrigin || (request.headers.get("Origin") !== siteOrigin && refererOrigin !== siteOrigin)) {
    return failImage("Origine non autorisée", 403);
  }
  const imageUrl = url.searchParams.get("url") || "";
  const sourceUrl = url.searchParams.get("ref") || "";
  if (!IMAGE_URLS.has(imageUrl) || !IMAGE_REFERENCES.has(sourceUrl)) {
    return failImage("Capture inconnue", 404);
  }
  let upstream;
  try {
    upstream = await fetch(imageUrl, {
      headers: {
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "referer": sourceUrl
      }
    });
  } catch {
    return failImage("Le site source ne répond pas", 502);
  }
  const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
  if (!upstream.ok || !contentType.startsWith("image/")) {
    console.error("dungeon_image_source_error", new URL(imageUrl).hostname, upstream.status);
    return failImage("La capture n’est pas disponible chez sa source", 502);
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...headers,
      "content-type": contentType,
      "cache-control": "public, max-age=86400, s-maxage=604800"
    }
  });
}

async function proxyBungieIcon(request, url, siteOrigin) {
  const headers = {
    "access-control-allow-origin": siteOrigin || "null",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "vary": "Origin",
    "cache-control": "public, max-age=86400, s-maxage=604800"
  };
  const failImage = (message, status) => new Response(message, {
    status,
    headers: { ...headers, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
  if (request.method !== "GET") return failImage("Méthode non autorisée", 405);
  let refererOrigin = "";
  try { refererOrigin = new URL(request.headers.get("Referer") || "").origin; } catch {}
  if (!siteOrigin || (request.headers.get("Origin") !== siteOrigin && refererOrigin !== siteOrigin)) {
    return failImage("Origine non autorisée", 403);
  }
  const assetPath = url.searchParams.get("path") || "";
  const prefix = "/common/destiny2_content/icons/";
  const iconName = assetPath.startsWith(prefix) ? assetPath.slice(prefix.length) : "";
  const extension = iconName.split(".").pop().toLowerCase();
  if (!iconName || assetPath.includes("..") || /[^A-Za-z0-9_./-]/.test(iconName) || !["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return failImage("Icône inconnue", 404);
  }
  let upstream;
  try {
    upstream = await fetch(new URL(assetPath, "https://www.bungie.net"), {
      headers: { "accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8", "referer": "https://www.bungie.net/" }
    });
  } catch {
    return failImage("Bungie ne répond pas", 502);
  }
  const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
  if (!upstream.ok || !contentType.startsWith("image/")) {
    console.error("bungie_icon_source_error", upstream.status);
    return failImage("L’icône Bungie n’est pas disponible", 502);
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { ...headers, "content-type": contentType }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const siteOrigin = env.SITE_ORIGIN || "";
    if (url.pathname === "/image") return proxyDungeonImage(request, url, siteOrigin);
    if (url.pathname === "/destiny-icon") return proxyBungieIcon(request, url, siteOrigin);
    if (!siteOrigin || origin !== siteOrigin) return fail("Origin non autorisée", 403, siteOrigin || "null");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": siteOrigin,
        "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "86400", "vary": "Origin"
      }});
    }
    if (url.pathname === "/guides") return handleSharedGuides(request, env, siteOrigin);
    if (!env.BUNGIE_API_KEY || !env.BUNGIE_CLIENT_ID) return fail("Secrets Bungie non configurés", 503, siteOrigin);

    try {
      if (url.pathname === "/oauth/token" && request.method === "POST") {
        const { code, redirectUri } = await request.json();
        if (!code || !redirectUri) return fail("Code OAuth ou URL de retour manquant", 400, siteOrigin);
        const form = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: env.BUNGIE_CLIENT_ID,
          redirect_uri: redirectUri
        });
        const response = await fetch(`${API}/App/OAuth/Token/`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "X-API-Key": env.BUNGIE_API_KEY },
          body: form
        });
        const result = await response.json();
        if (!response.ok || !result.access_token) {
          return fail("Bungie a refusé la connexion. Vérifie la redirection et le client OAuth.", 401, siteOrigin);
        }
        return reply({ access_token: result.access_token, expires_in: result.expires_in, membership_id: result.membership_id }, 200, siteOrigin);
      }

      const path = url.searchParams.get("path") || "";
      if (!allowedPath(path, request.method)) return fail("Route API non autorisée", 404, siteOrigin);
      const upstreamUrl = path.startsWith("/Platform/")
        ? `${new URL(path, "https://www.bungie.net").origin}${path}${url.searchParams.get("query") || ""}`
        : `https://www.bungie.net${path}${url.searchParams.get("query") || ""}`;
      const headers = { "X-API-Key": env.BUNGIE_API_KEY, "Accept": "application/json" };
      const authorization = request.headers.get("Authorization");
      if (authorization) headers.Authorization = authorization;
      const init = { method: request.method, headers };
      if (request.method === "POST") {
        init.headers["content-type"] = "application/json";
        init.body = await request.text();
      }
      const upstream = await fetch(upstreamUrl, init);
      return new Response(upstream.body, { status: upstream.status, headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": siteOrigin,
        "vary": "Origin"
      }});
    } catch {
      return fail("Erreur de communication avec Bungie", 502, siteOrigin);
    }
  }
};

