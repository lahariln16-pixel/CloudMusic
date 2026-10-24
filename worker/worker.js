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

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/list") return jsonResponse(await listSongs());
      if (url.pathname === "/videos") return jsonResponse(await listVideos());
      if (url.pathname === "/gallery") return jsonResponse(await listGallery());
    } catch (error) {
      console.error("CloudMusic Drive listing failed:", error);
      return jsonResponse({
        error: "Google Drive listing failed",
        detail: error instanceof Error ? error.message : "Unknown upstream error"
      }, 502);
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
