(() => {
  "use strict";
  const API = "https://cloud-music-proxy.mylahari.workers.dev";
  const $ = id => document.getElementById(id);
  const status = $("drive-oauth-status");
  const connect = $("drive-connect");

  async function getStatus() {
    try {
      const response = await fetch(API + "/oauth/status", { credentials: "include", cache: "no-store" });
      const data = await response.json();
      const connected = response.ok && data.connected === true;
      if (status) status.textContent = connected
        ? "Google Drive is connected. You can save song details and links."
        : "Connect Google Drive to save song details and links.";
      if (connect) connect.textContent = connected ? "Reconnect Google Drive" : "Connect Google Drive";
      return connected;
    } catch (error) {
      if (status) status.textContent = "Could not check Google Drive connection.";
      return false;
    }
  }

  async function saveTrack(track) {
    if (!track || !["Utop", "JioSaavn"].includes(track.source)) {
      throw new Error("Unsupported music source.");
    }
    const response = await fetch(API + "/save", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(track)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not save song details to Drive.");
    if (status) status.textContent = "Saved " + (track.title || "song") + " to Google Drive.";
    return data.saved;
  }

  connect?.addEventListener("click", () => {
    window.location.href = API + "/oauth/start";
  });

  window.CloudMusicDriveSave = { saveTrack, getStatus };
  const params = new URLSearchParams(window.location.search);
  if (params.get("drive") === "connected") {
    if (status) status.textContent = "Google Drive connected successfully.";
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  } else if (params.get("drive") === "error") {
    if (status) status.textContent = "Google Drive connection failed. Check the OAuth setup and try again.";
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  }
  getStatus();
})();