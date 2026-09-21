const MUSIC_FOLDER_ID = "1CNDhtkIoLf3VA-LP1PsWr3Lw9zxwD7vM";
const VIDEO_FOLDER_ID = "1Dsk4udZgNny-ZsROcLrIsGOoWSG9NmJa";
const GALLERY_FOLDER_ID = "1fC5zqm6oENDHbG-emZ-JtCAFyyTSzqrj";

const ALLOWED_ORIGIN = "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Accept-Ranges"
  };
}

async function listDriveFiles(folderId, extensions) {
  const folderUrl =
    `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;

  const response = await fetch(folderUrl);
  const html = await response.text();

  const files = [];
  const seen = new Set();
  const extensionPattern = extensions.join("|");

  const regex = new RegExp(
    `data-id="([A-Za-z0-9_-]{20,})"[\\s\\S]{0,1200}?(?:data-tooltip="([^"]+\\.(${extensionPattern}))\\s+[^"]*"|aria-label="([^"]+\\.(${extensionPattern}))\\s+[^"]*")`,
    "gi"
  );

  let match;

  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    const filename = match[2] || match[4];

    if (!id || !filename || seen.has(id)) continue;

    seen.add(id);

    files.push({
      id,
      title: filename.replace(
        new RegExp(`\\.(${extensionPattern})$`, "i"),
        ""
      ),
      filename
    });
  }

  return files;
}

async function listSongs() {
  const songs = await listDriveFiles(
    MUSIC_FOLDER_ID,
    ["mp3", "m4a", "wav", "flac"]
  );

  return songs.map(song => ({
    ...song,
    artist: "Unknown Artist"
  }));
}

async function listVideos() {
  return await listDriveFiles(
    VIDEO_FOLDER_ID,
    ["mp4", "webm", "mov", "mkv", "m4v"]
  );
}

async function listGallery() {
  return await listDriveFiles(
    GALLERY_FOLDER_ID,
    ["jpg", "jpeg", "png", "webp", "gif", "bmp"]
  );
}

async function streamFile(request, fileId) {
  const driveUrl =
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

  const requestHeaders = new Headers();

  const range = request.headers.get("Range");

  if (range) {
    requestHeaders.set("Range", range);
  }

  const driveResponse = await fetch(driveUrl, {
    method: "GET",
    headers: requestHeaders
  });

  const responseHeaders = new Headers(driveResponse.headers);

  responseHeaders.set(
    "Content-Type",
    driveResponse.headers.get("Content-Type") ||
      "application/octet-stream"
  );

  responseHeaders.set("Content-Disposition", "inline");
  responseHeaders.set(
    "Cross-Origin-Resource-Policy",
    "cross-origin"
  );

  for (const [key, value] of Object.entries(corsHeaders())) {
    responseHeaders.set(key, value);
  }

  return new Response(driveResponse.body, {
    status: driveResponse.status,
    headers: responseHeaders
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (url.pathname === "/list") {
      const songs = await listSongs();

      return new Response(JSON.stringify(songs), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders(),
          "Cache-Control": "no-cache"
        }
      });
    }

    if (url.pathname === "/videos") {
      const videos = await listVideos();

      return new Response(JSON.stringify(videos), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders(),
          "Cache-Control": "no-cache"
        }
      });
    }

    if (url.pathname === "/gallery") {
      const images = await listGallery();

      return new Response(JSON.stringify(images), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders(),
          "Cache-Control": "no-cache"
        }
      });
    }

    const fileId = url.searchParams.get("id");

    if (!fileId) {
      return new Response("Missing Google Drive file ID", {
        status: 400,
        headers: corsHeaders()
      });
    }

    return await streamFile(request, fileId);
  }
};
