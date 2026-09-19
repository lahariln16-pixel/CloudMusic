const FOLDER_ID = "1CNDhtkIoLf3VA-LP1PsWr3Lw9zxwD7vM";

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

async function listSongs() {
  const folderUrl =
    `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=sharing`;

  const response = await fetch(folderUrl);
  const html = await response.text();

  const songs = [];
  const seen = new Set();

  // Each Google Drive file row contains:
  // data-id="FILE_ID"
  // ...
  // data-tooltip="FILENAME.mp3 Audio"

  const regex =
    /data-id="([A-Za-z0-9_-]{20,})"[\s\S]{0,1200}?(?:data-tooltip="([^"]+\.(?:mp3|m4a|wav|flac))\s+Audio"|aria-label="([^"]+\.(?:mp3|m4a|wav|flac))\s+Audio")/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    const filename = match[2] || match[3];

    if (!id || !filename || seen.has(id)) continue;

    seen.add(id);

    songs.push({
      id,
      title: filename.replace(/\.(mp3|m4a|wav|flac)$/i, ""),
      filename,
      artist: "Unknown Artist"
    });
  }

  return songs;
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

    // GET /list → automatically discover songs
    if (url.pathname === "/list") {
      try {
        const songs = await listSongs();

        return new Response(JSON.stringify(songs), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(),
            "Cache-Control": "no-cache"
          }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Could not read Google Drive folder",
            details: String(error)
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders()
            }
          }
        );
      }
    }

    // Audio streaming
    const fileId = url.searchParams.get("id");

    if (!fileId) {
      return new Response("Missing Google Drive file ID", {
        status: 400,
        headers: corsHeaders()
      });
    }

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
      driveResponse.headers.get("Content-Type") || "audio/mpeg"
    );

    responseHeaders.set("Content-Disposition", "inline");
    responseHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

    for (const [key, value] of Object.entries(corsHeaders())) {
      responseHeaders.set(key, value);
    }

    return new Response(driveResponse.body, {
      status: driveResponse.status,
      headers: responseHeaders
    });
  }
};
