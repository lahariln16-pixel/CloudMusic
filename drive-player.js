(() => {
  "use strict";
  const API = "https://cloud-music-proxy.cloudmusiclahari.workers.dev";
  const audio = new Audio();
  let songs = [];
  let filtered = [];
  let currentIndex = -1;
  let shuffle = false;
  let repeat = false;
  let muted = false;
  let volumeBeforeMute = 1;
  const $ = (id) => document.getElementById(id);
  const list = $("drive-library-list");
  const status = $("drive-library-status");
  const count = $("drive-song-count");
  const search = $("drive-library-search");
  const playIcon = $("drive-player-play-icon");
  const fill = $("drive-player-progress-fill");
  const currentTime = $("drive-player-current-time");
  const duration = $("drive-player-duration");
  const favorite = $("drive-player-favorite");
  const favorites = new Set(JSON.parse(localStorage.getItem("cloudmusic-favorites") || "[]"));

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function time(value) {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    return Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0");
  }
  function trackUrl(song) { return API + "/?id=" + encodeURIComponent(song.id); }
  function render() {
    filtered = songs.filter(s => (s.title + " " + (s.artist || "")).toLowerCase().includes((search?.value || "").trim().toLowerCase()));
    count.textContent = filtered.length + (filtered.length === 1 ? " song" : " songs");
    list.innerHTML = "";
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "p-space-md text-on-surface-variant";
      empty.textContent = songs.length ? "No matching songs. Try a different search." : "Your Drive library is empty or could not be loaded.";
      list.appendChild(empty);
      return;
    }
    filtered.forEach((song, i) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "w-full flex items-center gap-space-md px-space-sm py-space-md text-left hover:bg-surface-container-high rounded-xl transition-colors";
      row.innerHTML = '<span class="w-9 text-center text-on-surface-variant font-body-sm">'+String(i+1).padStart(2,"0")+'</span><span class="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined">music_note</span></span><span class="min-w-0 flex-1"><span class="block truncate font-label-lg text-label-lg text-on-surface">'+escapeHTML(song.title)+'</span><span class="block truncate font-body-sm text-body-sm text-on-surface-variant">'+escapeHTML(song.artist || "Unknown artist")+'</span></span><span class="material-symbols-outlined text-primary">'+(songs.indexOf(song)===currentIndex && !audio.paused ? "graphic_eq" : "play_arrow")+'</span>';
      row.addEventListener("click", () => playSong(songs.indexOf(song), true));
      list.appendChild(row);
    });
  }
  function updateFavorite() {
    const song = songs[currentIndex];
    const isFav = !!song && favorites.has(song.id);
    favorite?.classList.toggle("text-primary", isFav);
    favorite?.classList.toggle("text-on-surface-variant", !isFav);
    favorite?.setAttribute("aria-pressed", String(isFav));
    const icon = favorite?.querySelector(".material-symbols-outlined");
    if (icon) icon.textContent = isFav ? "favorite" : "favorite_border";
  }
  function selectSong(index) {
    if (!songs.length) return false;
    currentIndex = (index + songs.length) % songs.length;
    const song = songs[currentIndex];
    audio.src = trackUrl(song);
    $("drive-player-title").textContent = song.title || "Untitled";
    $("drive-player-artist").textContent = song.artist || "Unknown artist";
    $("drive-player-art").innerHTML = '<span class="material-symbols-outlined text-2xl">music_note</span>';
    fill.style.width = "0%";
    currentTime.textContent = "0:00";
    duration.textContent = "0:00";
    updateFavorite();
    render();
    return true;
  }
  async function playSong(index, autoplay) {
    if (!selectSong(index)) return;
    if (autoplay) {
      try { await audio.play(); }
      catch (e) { status.textContent = "Playback could not start. Check that the CloudMusic Worker can stream this Drive file."; console.error(e); }
    }
  }
  function next() {
    if (!songs.length) return;
    let index = currentIndex + 1;
    if (shuffle && songs.length > 1) {
      do { index = Math.floor(Math.random() * songs.length); } while (index === currentIndex);
    }
    playSong(index >= songs.length ? 0 : index, true);
  }
  async function loadSongs() {
    status.textContent = "Loading your Google Drive songs…";
    try {
      const response = await fetch(API + "/list");
      if (!response.ok) throw new Error("Worker returned HTTP " + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected library response");
      songs = data.filter(s => s && s.id).map(s => ({...s, title: s.title || s.name || "Untitled", artist: s.artist || "Unknown artist"}));
      filtered = songs;
      status.textContent = songs.length ? "Connected to your CloudMusic Google Drive library." : "No songs were returned by your Google Drive library.";
      if (songs.length) selectSong(0);
      render();
    } catch (e) {
      status.textContent = "Could not load Drive songs. Check the CloudMusic Worker connection and try Refresh library.";
      count.textContent = "Library unavailable";
      console.error("CloudMusic Drive library:", e);
    }
  }
  $("drive-player-play")?.addEventListener("click", async () => {
    if (!songs.length) return;
    if (currentIndex < 0) selectSong(0);
    if (audio.paused) {
      try { await audio.play(); } catch (e) { console.error(e); }
    } else audio.pause();
  });
  $("drive-player-prev")?.addEventListener("click", () => {
    if (!songs.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    playSong((currentIndex - 1 + songs.length) % songs.length, true);
  });
  $("drive-player-next")?.addEventListener("click", next);
  $("drive-player-shuffle")?.addEventListener("click", e => {
    shuffle = !shuffle; e.currentTarget.classList.toggle("text-primary", shuffle);
    e.currentTarget.title = shuffle ? "Disable shuffle" : "Enable shuffle";
  });
  $("drive-player-repeat")?.addEventListener("click", e => {
    repeat = !repeat; e.currentTarget.classList.toggle("text-primary", repeat);
    e.currentTarget.title = repeat ? "Disable repeat" : "Enable repeat";
  });
  favorite?.addEventListener("click", () => {
    const song = songs[currentIndex]; if (!song) return;
    favorites.has(song.id) ? favorites.delete(song.id) : favorites.add(song.id);
    localStorage.setItem("cloudmusic-favorites", JSON.stringify([...favorites]));
    updateFavorite();
  });
  search?.addEventListener("input", render);
  $("drive-refresh")?.addEventListener("click", loadSongs);
  $("drive-player-progress")?.addEventListener("click", e => {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audio.duration;
  });
  $("drive-player-volume")?.addEventListener("click", e => {
    const rect = e.currentTarget.getBoundingClientRect();
    audio.volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    volumeBeforeMute = audio.volume; muted = audio.volume === 0;
    $("drive-player-volume-fill").style.width = (audio.volume * 100) + "%";
  });
  $("drive-player-mute")?.addEventListener("click", () => {
    muted = !muted;
    audio.volume = muted ? 0 : volumeBeforeMute;
    $("drive-player-volume-fill").style.width = (audio.volume * 100) + "%";
    $("drive-player-mute").title = muted ? "Unmute" : "Mute";
  });
  audio.addEventListener("play", () => { playIcon.textContent = "pause"; status.textContent = "Now playing from your Drive library."; render(); });
  audio.addEventListener("pause", () => { playIcon.textContent = "play_arrow"; render(); });
  audio.addEventListener("timeupdate", () => {
    currentTime.textContent = time(audio.currentTime);
    duration.textContent = time(audio.duration);
    fill.style.width = audio.duration ? (audio.currentTime / audio.duration * 100) + "%" : "0%";
  });
  audio.addEventListener("ended", () => {
    if (repeat) { audio.currentTime = 0; audio.play().catch(console.error); }
    else next();
  });
  audio.volume = 1;
  $("drive-player-volume-fill").style.width = "100%";
  loadSongs();
})();