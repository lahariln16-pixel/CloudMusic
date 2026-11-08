const MUSIC_FOLDER_ID = "1CNDhtkIoLf3VA-LP1PsWr3Lw9zxwD7vM";
const VIDEO_FOLDER_ID = "1Dsk4udZgNny-ZsROcLrIsGOoWSG9NmJa";
const GALLERY_FOLDER_ID = "1fC5zqm6oENDHbG-emZ-JtCAFyyTSzqrj";

const ALLOWED_ORIGIN = "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges"
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders()
    }
  });
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/\\x26/gi, "&")
    .trim();
}

async function listDriveFiles(folderId, extensions) {
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;
  const response = await fetch(folderUrl, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; CloudMusic/1.0)"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Google Drive returned HTTP ${response.status} while listing folder files.`);
  }

  const html = await response.text();
  if (!html || /accounts\.google\.com\/ServiceLogin|Sign in - Google Accounts/i.test(html)) {
    throw new Error("The Google Drive folder is private or requires sign-in. Set the folder to 'Anyone with the link' can view.");
  }
  if (!/drive\.google\.com|googleusercontent\.com/i.test(response.url)) {
    throw new Error("Google Drive redirected to an unexpected page.");
  }

  const extensionPattern = extensions.map(ext => ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const filenamePattern = new RegExp(
    `(?:data-tooltip|aria-label|title|name)=[\\\"']([^\\\"']+\\.(?:${extensionPattern}))(?:\\s+[^\\\"']*)?[\\\"']|([A-Za-z0-9 _.,()\\[\\]{}!@#$%^&+=~-]+\\.(?:${extensionPattern}))(?:\\\\u0026|&|\\s|<|>|\\\\")`,
    "gi"
  );

  const files = [];
  const seen = new Set();

  // Drive's folder HTML has changed several times. Find file IDs and pair them
  // with the closest supported filename in the surrounding row/serialized data.
  const idPattern = /data-id=["']([A-Za-z0-9_-]{20,})["']/gi;
  const idMatches = [...html.matchAll(idPattern)];

  for (const idMatch of idMatches) {
    const id = idMatch[1];
    if (!id || seen.has(id)) continue;

    const idPosition = idMatch.index ?? 0;
    const from = Math.max(0, idPosition - 1800);
    const to = Math.min(html.length, idPosition + 3200);
    const nearby = html.slice(from, to);

    let filename = "";
    let bestDistance = Number.POSITIVE_INFINITY;
    filenamePattern.lastIndex = 0;
    let nameMatch;

    while ((nameMatch = filenamePattern.exec(nearby)) !== null) {
      const rawName = decodeHtml(nameMatch[1] || nameMatch[2]);
      const supported = rawName.match(new RegExp(`\\.(?:${extensionPattern})$`, "i"));
      if (!supported) continue;

      const namePosition = from + nameMatch.index;
      const distance = Math.abs(namePosition - idPosition);
      if (distance < bestDistance) {
        filename = rawName.replace(/\\\\u003[cC]/g, "<").replace(/\\\\u003[eE]/g, ">");
        bestDistance = distance;
      }
    }

    // Fallback for common serialized Drive data where the filename is stored
    // after a "name":"..." field instead of in an HTML attribute.
    if (!filename) {
      const jsonNamePattern = new RegExp(
        `["']name["']\\s*:\\s*["']([^"']+\\.(?:${extensionPattern}))["']`,
        "gi"
      );
      jsonNamePattern.lastIndex = 0;
      let jsonMatch;
      while ((jsonMatch = jsonNamePattern.exec(nearby)) !== null) {
        filename = decodeHtml(jsonMatch[1]);
        break;
      }
    }

    if (!filename) continue;
    seen.add(id);
    files.push({
      id,
      title: filename.replace(new RegExp(`\\.(?:${extensionPattern})$`, "i"), ""),
      filename
    });
  }

  // A public folder page that loads but contains no supported files should
  // return an empty list; callers can distinguish it from a failed request.
  return files;
}

async function listSongs() {
  const songs = await listDriveFiles(MUSIC_FOLDER_ID, ["mp3", "m4a", "wav", "flac"]);
  return songs.map(song => ({ ...song, artist: "Unknown Artist" }));
}

async function listVideos() {
  return await listDriveFiles(VIDEO_FOLDER_ID, ["mp4", "webm", "mov", "mkv", "m4v"]);
}

async function listGallery() {
  return await listDriveFiles(GALLERY_FOLDER_ID, ["jpg", "jpeg", "png", "webp", "gif", "bmp"]);
}


async function audiusRequest(path) {
  const response = await fetch(`https://api.audius.co/v1${path}`, {
    headers: { "Accept": "application/json" },
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`Audius returned HTTP ${response.status}`);
  return await response.json();
}

async function streamAudiusTrack(request, trackId) {
  const streamUrl = new URL(`https://api.audius.co/v1/tracks/${encodeURIComponent(trackId)}/stream`);
  streamUrl.searchParams.set("app_name", "CloudMusic");
  const headers = new Headers();
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);
  const upstream = await fetch(streamUrl, { headers, redirect: "follow" });
  if (!upstream.ok) {
    return jsonResponse({ error: "Audius stream unavailable", detail: `HTTP ${upstream.status}` }, upstream.status);
  }
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "audio/mpeg");
  responseHeaders.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type, Authorization");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  responseHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function streamFile(request, fileId) {
  const driveUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const requestHeaders = new Headers();
  const range = request.headers.get("Range");
  if (range) requestHeaders.set("Range", range);

  const driveResponse = await fetch(driveUrl, {
    method: "GET",
    headers: requestHeaders,
    redirect: "follow"
  });

  const responseHeaders = new Headers(driveResponse.headers);
  responseHeaders.set("Content-Type", driveResponse.headers.get("Content-Type") || "application/octet-stream");
  responseHeaders.set("Content-Disposition", "inline");
  responseHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
  for (const [key, value] of Object.entries(corsHeaders())) responseHeaders.set(key, value);

  return new Response(driveResponse.body, { status: driveResponse.status, headers: responseHeaders });
}


const DRIVE_APP_ORIGIN = "https://cloudmusic-75y.pages.dev";
const DRIVE_REDIRECT_URI = "https://cloud-music-proxy.mylahari.workers.dev/oauth/callback";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function oauthHeaders(request, extra = {}) {
  const origin = request.headers.get("Origin");
  const allowed = origin === DRIVE_APP_ORIGIN ? DRIVE_APP_ORIGIN : DRIVE_APP_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    ...extra
  };
}

function oauthJson(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...oauthHeaders(request) }
  });
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map(value => value.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const match = raw.split(";").map(part => part.trim()).find(part => part.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

async function driveSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
        const session = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!session || !env.DRIVE_OAUTH) return false;
  return !!(await env.DRIVE_OAUTH.get("session:" + session));
}

async function driveAccessToken(env) {
  const refreshToken = await env.DRIVE_OAUTH.get("drive:refresh_token");
  if (!refreshToken) throw new Error("Google Drive is not connected. Connect your account first.");
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error("Google Drive token refresh failed. Reconnect your account.");
  return payload.access_token;
}

async function driveApi(env, accessToken, path, options = {}) {
  const response = await fetch("https://www.googleapis.com/drive/v3" + path, {
    ...options,
    headers: { Authorization: "Bearer " + accessToken, ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Google Drive API returned HTTP " + response.status);
  return payload;
}

async function ensureDriveFolder(env, accessToken, name, parentId = "") {
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const query = ["name = '" + escaped + "'", "mimeType = 'application/vnd.google-apps.folder'", "trashed = false"];
  if (parentId) query.push("'" + parentId + "' in parents");
  const params = new URLSearchParams({ q: query.join(" and "), fields: "files(id,name)", pageSize: "10" });
  const found = await driveApi(env, accessToken, "/files?" + params.toString());
  if (found.files?.length) return found.files[0].id;
  const created = await driveApi(env, accessToken, "/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) })
  });
  return created.id;
}

async function saveSongMetadata(env, track) {
  const accessToken = await driveAccessToken(env);
  const root = await ensureDriveFolder(env, accessToken, "CloudMusic");
  const source = track.source === "JioSaavn" ? "JioSaavn" : "Utop";
  const folder = await ensureDriveFolder(env, accessToken, source, root);
  const safeTitle = String(track.title || "Untitled song").replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);
  const safeArtist = String(track.artist || "Unknown artist").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  const record = {
    source,
    title: String(track.title || "Untitled song").slice(0, 300),
    artist: String(track.artist || "Unknown artist").slice(0, 300),
    sourceUrl: String(track.sourceUrl || "").slice(0, 2000),
    artwork: String(track.artwork || "").slice(0, 2000),
    savedAt: new Date().toISOString(),
    note: "Saved song details and source link. This file does not contain the audio recording."
  };
  if (!record.sourceUrl || !/^https:\/\//i.test(record.sourceUrl)) throw new Error("A valid original song link is required.");
  const boundary = "cloudmusic_" + randomToken(12);
  const metadata = { name: safeTitle + " - " + safeArtist + ".json", mimeType: "application/json", parents: [folder] };
  const body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(record, null, 2) + "\r\n--" + boundary + "--";
  const saved = await driveApi(env, accessToken, "/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: { "Content-Type": "multipart/related; boundary=" + boundary },
    body
  });
  return { id: saved.id, name: saved.name, webViewLink: saved.webViewLink || "" };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/oauth/") || url.pathname === "/save") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: oauthHeaders(request) });
      if (!env.DRIVE_OAUTH || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return oauthJson(request, { error: "Drive OAuth is not configured. Add the DRIVE_OAUTH KV binding and Google OAuth secrets." }, 503);
      }
      if (url.pathname === "/oauth/start" && request.method === "GET") {
        const state = randomToken();
        await env.DRIVE_OAUTH.put("oauth_state:" + state, "pending", { expirationTtl: 600 });
        const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        auth.search = new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri: DRIVE_REDIRECT_URI,
          response_type: "code",
          scope: DRIVE_SCOPE,
          access_type: "offline",
          prompt: "consent",
          state
        }).toString();
        return Response.redirect(auth.toString(), 302);
      }
      if (url.pathname === "/oauth/callback" && request.method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const stateKey = state ? "oauth_state:" + state : "";
        const validState = stateKey ? await env.DRIVE_OAUTH.get(stateKey) : null;
        if (!code || !validState) return Response.redirect(DRIVE_APP_ORIGIN + "/?drive=error", 302);
        await env.DRIVE_OAUTH.delete(stateKey);
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: DRIVE_REDIRECT_URI,
            grant_type: "authorization_code"
          })
        });
        const tokens = await tokenResponse.json();
        if (!tokenResponse.ok || !tokens.refresh_token) {
          return Response.redirect(DRIVE_APP_ORIGIN + "/?drive=error", 302);
        }
        await env.DRIVE_OAUTH.put("drive:refresh_token", tokens.refresh_token);
        const session = randomToken();
        await env.DRIVE_OAUTH.put("session:" + session, "connected", { expirationTtl: 60 * 60 * 24 * 30 });
        return new Response(null, {
          status: 302,
          headers: {
            Location: DRIVE_APP_ORIGIN + "/?drive=connected#drive_session=" + session,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer"
          }
        });
      }
      if (url.pathname === "/oauth/status" && request.method === "GET") {
        return oauthJson(request, { connected: await driveSession(request, env) });
      }
      if (url.pathname === "/oauth/disconnect" && request.method === "POST") {
        const session = cookieValue(request, "cm_drive_session");
        if (session) await env.DRIVE_OAUTH.delete("session:" + session);
        return new Response(JSON.stringify({ connected: false }), {
          headers: { "Content-Type": "application/json", ...oauthHeaders(request) }
        });
      }
      if (url.pathname === "/save" && request.method === "POST") {
        if (!(await driveSession(request, env))) return oauthJson(request, { error: "Connect Google Drive before saving songs." }, 401);
        try {
          const track = await request.json();
          if (!track || !["Utop", "JioSaavn"].includes(track.source)) return oauthJson(request, { error: "Unsupported music source." }, 400);
          const saved = await saveSongMetadata(env, track);
          return oauthJson(request, { ok: true, saved });
        } catch (error) {
          return oauthJson(request, { error: error instanceof Error ? error.message : "Could not save song details." }, 502);
        }
      }
      return oauthJson(request, { error: "Method not allowed or route not found." }, 404);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/list") return jsonResponse(await listSongs());
      if (url.pathname === "/videos") return jsonResponse(await listVideos());
      if (url.pathname === "/gallery") return jsonResponse(await listGallery());
      if (url.pathname === "/audius/search") {
        const query = (url.searchParams.get("q") || "").trim();
        if (!query) return jsonResponse({ data: [] });
        const params = new URLSearchParams({ query, limit: "24" });
        return jsonResponse(await audiusRequest(`/tracks/search?${params}`));
      }
      if (url.pathname === "/audius/trending") {
        const params = new URLSearchParams({ limit: "24", time: "week" });
        return jsonResponse(await audiusRequest(`/tracks/trending?${params}`));
      }
    } catch (error) {
      console.error("CloudMusic Drive listing failed:", error);
      return jsonResponse({
        error: "Google Drive listing failed",
        detail: error instanceof Error ? error.message : "Unknown upstream error"
      }, 502);
    }

    if (url.pathname === "/audius/stream") {
      const trackId = url.searchParams.get("id");
      if (!trackId) return new Response("Missing Audius track ID", { status: 400, headers: corsHeaders() });
      try {
        return await streamAudiusTrack(request, trackId);
      } catch (error) {
        console.error("CloudMusic Audius stream failed:", error);
        return jsonResponse({ error: "Audius stream failed", detail: error instanceof Error ? error.message : "Unknown error" }, 502);
      }
    }

    const fileId = url.searchParams.get("id");
    if (!fileId) {
      return new Response("Missing Google Drive file ID", { status: 400, headers: corsHeaders() });
    }

    try {
      return await streamFile(request, fileId);
    } catch (error) {
      console.error("CloudMusic Drive stream failed:", error);
      return new Response("Google Drive could not stream this file.", { status: 502, headers: corsHeaders() });
    }
  }
};
