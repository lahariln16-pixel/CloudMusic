(() => {
  "use strict";

  const API = "https://cloud-music-proxy.mylahari.workers.dev";
  const CATEGORY_KEY = "cloudmusic-culture-categories-v1";
  const ASSIGNMENT_KEY = "cloudmusic-culture-assignments-v1";
  const $ = id => document.getElementById(id);

  const defaults = [
    { id: "kpop", name: "K-Pop Universe", language: "Korean", emoji: "🎤" },
    { id: "latin", name: "Latin Fuego & Reggaeton", language: "Spanish / Latin", emoji: "💃" },
    { id: "global", name: "Global Top 50", language: "Worldwide", emoji: "🌍" },
    { id: "desi", name: "Desi Beats & Bollywood", language: "Indian languages", emoji: "🪘" },
    { id: "jrock", name: "J-Rock & Anime Hits", language: "Japanese", emoji: "🎸" },
    { id: "french", name: "French Rap & Chanson", language: "French", emoji: "🎧" },
    { id: "afrobeats", name: "Afrobeats & Amapiano", language: "African music", emoji: "🥁" },
    { id: "nordic", name: "Nordic Ambient & Neo-Folk", language: "Nordic", emoji: "❄️" }
  ];

  let categories = readJSON(CATEGORY_KEY, defaults);
  let assignments = readJSON(ASSIGNMENT_KEY, {});
  let songs = [];
  let selectedCategory = null;

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? JSON.parse(JSON.stringify(fallback));
    } catch {
      return JSON.parse(JSON.stringify(fallback));
    }
  }
  function save() {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
    localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignments));
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function songId(song) { return String(song.id); }
  function songLabel(song) { return (song.title || song.name || "Untitled") + " — " + (song.artist || "Unknown artist"); }
  function categorySongs(categoryId) { return songs.filter(song => assignments[songId(song)] === categoryId); }

  function renderCategories() {
    const grid = $("culture-category-grid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!categories.length) {
      grid.innerHTML = '<div class="col-span-full rounded-xl bg-surface-container-high p-space-md text-on-surface-variant">No categories yet. Choose Manage categories to create one.</div>';
      return;
    }
    categories.forEach(category => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "group min-h-40 rounded-2xl border border-outline-variant/20 bg-gradient-to-br from-surface-container-high to-surface-container-low p-space-md text-left hover:border-primary/60 hover:-translate-y-0.5 transition-all";
      card.setAttribute("aria-label", "Browse " + category.name);
      const amount = categorySongs(category.id).length;
      card.innerHTML = '<div class="flex items-start justify-between gap-3"><span class="text-3xl" aria-hidden="true">' + escapeHTML(category.emoji || "🎵") + '</span><span class="rounded-full bg-surface-container-lowest/70 px-2.5 py-1 text-xs text-primary">' + amount + (amount === 1 ? ' song' : ' songs') + '</span></div><h3 class="mt-5 font-headline-md text-headline-md text-on-surface group-hover:text-primary">' + escapeHTML(category.name) + '</h3><p class="mt-1 text-sm text-on-surface-variant">' + escapeHTML(category.language || "Custom culture") + '</p><p class="mt-3 text-xs text-primary">Browse songs →</p>';
      card.addEventListener("click", () => showCategory(category.id));
      grid.appendChild(card);
    });
  }

  function showCategory(categoryId) {
    selectedCategory = categoryId;
    const category = categories.find(item => item.id === categoryId);
    if (!category) return;
    $("culture-category-detail").classList.remove("hidden");
    $("culture-detail-title").textContent = (category.emoji || "🎵") + " " + category.name;
    $("culture-detail-subtitle").textContent = category.language || "Custom culture";
    const container = $("culture-detail-songs");
    container.innerHTML = "";
    const matched = categorySongs(categoryId);
    if (!matched.length) {
      container.innerHTML = '<p class="py-5 text-on-surface-variant">No songs assigned yet. Choose Manage categories and assign songs below.</p>';
    } else {
      matched.forEach(song => {
        const row = document.createElement("div");
        row.className = "flex items-center gap-3 py-3";
        row.innerHTML = '<span class="material-symbols-outlined text-primary">music_note</span><div class="min-w-0 flex-1"><p class="truncate text-on-surface font-label-md">' + escapeHTML(song.title || song.name || "Untitled") + '</p><p class="truncate text-sm text-on-surface-variant">' + escapeHTML(song.artist || "Unknown artist") + '</p></div>';
        container.appendChild(row);
      });
    }
    $("culture-category-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderManagerCategories() {
    const container = $("culture-manager-categories");
    container.innerHTML = "";
    categories.forEach(category => {
      const row = document.createElement("div");
      row.className = "grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center rounded-xl bg-surface-container p-3";
      row.innerHTML = '<input aria-label="Category name" maxlength="60" class="culture-edit-name min-w-0 rounded-lg bg-surface-container-high px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary" value="' + escapeHTML(category.name) + '"><input aria-label="Language or culture" maxlength="80" class="culture-edit-language min-w-0 rounded-lg bg-surface-container-high px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary" value="' + escapeHTML(category.language || "") + '"><button type="button" class="culture-save-category rounded-lg px-3 py-2 bg-primary-container text-on-primary-fixed text-sm">Save</button><button type="button" class="culture-delete-category rounded-lg px-3 py-2 bg-surface-container-high text-on-surface text-sm">Delete</button>';
      row.querySelector(".culture-save-category").addEventListener("click", () => {
        const name = row.querySelector(".culture-edit-name").value.trim();
        const language = row.querySelector(".culture-edit-language").value.trim();
        if (!name) { setStatus("Category name cannot be empty."); return; }
        category.name = name;
        category.language = language;
        save(); renderAll();
        setStatus("Saved category: " + name);
      });
      row.querySelector(".culture-delete-category").addEventListener("click", () => {
        if (!confirm('Delete "' + category.name + '"? Songs will become unassigned, not deleted.')) return;
        categories = categories.filter(item => item.id !== category.id);
        Object.keys(assignments).forEach(id => { if (assignments[id] === category.id) delete assignments[id]; });
        if (selectedCategory === category.id) {
          selectedCategory = null;
          $("culture-category-detail").classList.add("hidden");
        }
        save(); renderAll(); setStatus("Category deleted. Its songs remain in your Drive library.");
      });
      container.appendChild(row);
    });
  }

  function renderAssignments() {
    const container = $("culture-song-assignments");
    const query = ($("culture-song-search").value || "").trim().toLowerCase();
    container.innerHTML = "";
    const matches = songs.filter(song => songLabel(song).toLowerCase().includes(query));
    if (!matches.length) {
      container.innerHTML = '<p class="py-4 text-on-surface-variant">' + (songs.length ? "No matching songs." : "No Drive songs loaded yet.") + '</p>';
      return;
    }
    matches.forEach(song => {
      const row = document.createElement("div");
      row.className = "grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(180px,260px)] gap-3 items-center py-3";
      const current = assignments[songId(song)] || "";
      row.innerHTML = '<div class="min-w-0"><p class="truncate text-on-surface font-label-md">' + escapeHTML(song.title || song.name || "Untitled") + '</p><p class="truncate text-sm text-on-surface-variant">' + escapeHTML(song.artist || "Unknown artist") + '</p></div><select aria-label="Category for ' + escapeHTML(song.title || song.name || "song") + '" class="culture-song-category w-full rounded-lg bg-surface-container-high px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"><option value="">Uncategorized</option>' + categories.map(category => '<option value="' + escapeHTML(category.id) + '"' + (current === category.id ? " selected" : "") + '>' + escapeHTML(category.name) + '</option>').join("") + '</select>';
      row.querySelector("select").addEventListener("change", event => {
        if (event.target.value) assignments[songId(song)] = event.target.value;
        else delete assignments[songId(song)];
        save();
        renderCategories();
        if (selectedCategory) showCategory(selectedCategory);
        setStatus("Song category saved.");
      });
      container.appendChild(row);
    });
  }

  function renderAll() {
    renderCategories();
    renderManagerCategories();
    renderAssignments();
    if (selectedCategory) showCategory(selectedCategory);
  }
  function setStatus(message) { $("culture-manager-status").textContent = message; }

  $("culture-manage-toggle")?.addEventListener("click", () => {
    $("culture-manager").classList.toggle("hidden");
    if (!$("culture-manager").classList.contains("hidden")) $("culture-manager").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("culture-manager-close")?.addEventListener("click", () => $("culture-manager").classList.add("hidden"));
  $("culture-detail-close")?.addEventListener("click", () => $("culture-category-detail").classList.add("hidden"));
  $("culture-category-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("culture-category-name").value.trim();
    const language = $("culture-category-language").value.trim();
    if (!name) return;
    const id = "culture-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    categories.push({ id, name, language, emoji: "🎵" });
    $("culture-category-name").value = "";
    $("culture-category-language").value = "";
    save(); renderAll(); setStatus("Added category: " + name);
  });
  $("culture-song-search")?.addEventListener("input", renderAssignments);

  async function loadSongs() {
    try {
      const response = await fetch(API + "/list");
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected song list response");
      songs = data.filter(song => song && song.id).map(song => ({
        ...song,
        title: song.title || song.name || "Untitled",
        artist: song.artist || "Unknown artist"
      }));
      renderAll();
      setStatus(songs.length + " songs loaded. Category edits are saved in this browser.");
    } catch (error) {
      console.error("CloudMusic culture categories:", error);
      $("culture-category-grid").innerHTML = '<p class="col-span-full rounded-xl bg-surface-container-high p-space-md text-on-surface-variant">Could not load songs from Drive. You can still edit categories; try refreshing the page after the Worker is available.</p>';
      renderManagerCategories();
      renderAssignments();
      setStatus("Could not load the Drive library. Category names can still be edited.");
    }
  }

  renderAll();
  loadSongs();
})();