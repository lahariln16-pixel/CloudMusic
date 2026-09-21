const API = "https://cloud-music-proxy.cloudmusiclahari.workers.dev";

const grid = document.querySelector("#galleryGrid");
const empty = document.querySelector("#galleryEmpty");
const search = document.querySelector("#gallerySearch");

const viewer = document.querySelector("#imageViewer");
const viewerImage = document.querySelector("#viewerImage");
const viewerTitle = document.querySelector("#viewerTitle");

const closeViewer = document.querySelector("#closeViewer");
const prevImage = document.querySelector("#prevImage");
const nextImage = document.querySelector("#nextImage");

let images = [];
let filteredImages = [];
let currentIndex = 0;

async function loadGallery() {
    try {
        const response = await fetch(`${API}/gallery`);

        if (!response.ok) {
            throw new Error(`Gallery API returned ${response.status}`);
        }

        images = await response.json();
        filteredImages = [...images];

        renderGallery();
    } catch (error) {
        console.error("Gallery error:", error);
        empty.textContent = "Could not load Cloud Gallery.";
        empty.style.display = "block";
    }
}

function renderGallery() {
    grid.innerHTML = "";

    if (!filteredImages.length) {
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";

    filteredImages.forEach((image, index) => {
        const card = document.createElement("div");
        card.className = "gallery-item";

        const img = document.createElement("img");

        img.src = `${API}/?id=${encodeURIComponent(image.id)}`;
        img.alt = image.title;
        img.loading = "lazy";

        card.appendChild(img);

        card.addEventListener("click", () => {
            openViewer(index);
        });

        grid.appendChild(card);
    });
}

function openViewer(index) {
    currentIndex = index;

    const image = filteredImages[currentIndex];

    viewerImage.src =
        `${API}/?id=${encodeURIComponent(image.id)}`;

    viewerImage.alt = image.title;
    viewerTitle.textContent = image.filename;

    viewer.classList.add("show");
}

function closeImageViewer() {
    viewer.classList.remove("show");
    viewerImage.src = "";
}

function showPrevious() {
    if (!filteredImages.length) return;

    currentIndex =
        (currentIndex - 1 + filteredImages.length) %
        filteredImages.length;

    openViewer(currentIndex);
}

function showNext() {
    if (!filteredImages.length) return;

    currentIndex =
        (currentIndex + 1) %
        filteredImages.length;

    openViewer(currentIndex);
}

search.addEventListener("input", () => {
    const query = search.value.toLowerCase().trim();

    filteredImages = images.filter(image =>
        image.filename.toLowerCase().includes(query)
    );

    renderGallery();
});

closeViewer.addEventListener("click", closeImageViewer);
prevImage.addEventListener("click", showPrevious);
nextImage.addEventListener("click", showNext);

viewer.addEventListener("click", event => {
    if (event.target === viewer) {
        closeImageViewer();
    }
});

document.addEventListener("keydown", event => {
    if (!viewer.classList.contains("show")) return;

    if (event.key === "Escape") {
        closeImageViewer();
    }

    if (event.key === "ArrowLeft") {
        showPrevious();
    }

    if (event.key === "ArrowRight") {
        showNext();
    }
});

loadGallery();

