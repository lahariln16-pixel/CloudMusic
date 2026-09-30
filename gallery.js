const API =
    "https://cloud-music-proxy.cloudmusiclahari.workers.dev";

const GALLERY_TOKEN_KEY =
    "cloud_music_gallery_token";

const grid =
    document.querySelector("#galleryGrid");

const empty =
    document.querySelector("#galleryEmpty");

const search =
    document.querySelector("#gallerySearch");

const viewer =
    document.querySelector("#imageViewer");

const viewerImage =
    document.querySelector("#viewerImage");

const viewerTitle =
    document.querySelector("#viewerTitle");

const closeViewer =
    document.querySelector("#closeViewer");

const prevImage =
    document.querySelector("#prevImage");

const nextImage =
    document.querySelector("#nextImage");

let images = [];
let filteredImages = [];
let currentIndex = 0;


/* =========================
   PASSWORD SCREEN
   ========================= */

function showPasswordScreen() {
    if (
        document.querySelector(
            "#galleryPasswordScreen"
        )
    ) {
        return;
    }

    const screen =
        document.createElement(
            "div"
        );

    screen.id =
        "galleryPasswordScreen";

    screen.innerHTML = `
        <div style="
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0,0,0,0.94);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        ">
            <form id="galleryPasswordForm" style="
                width: min(420px, 100%);
                background: #111;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 18px;
                padding: 32px;
                box-sizing: border-box;
                text-align: center;
                box-shadow: 0 20px 70px rgba(0,0,0,0.5);
            ">

                <div style="
                    font-size: 48px;
                    margin-bottom: 14px;
                ">
                    🔐
                </div>

                <h2 style="
                    color: white;
                    margin: 0 0 8px;
                    font-size: 25px;
                ">
                    Private Gallery
                </h2>

                <p style="
                    color: #999;
                    margin: 0 0 24px;
                    font-size: 14px;
                ">
                    Enter the password to access Cloud Gallery.
                </p>

                <input
                    id="galleryPasswordInput"
                    type="password"
                    placeholder="Enter password"
                    autocomplete="current-password"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 14px 16px;
                        border-radius: 10px;
                        border: 1px solid #333;
                        background: #1c1c1c;
                        color: white;
                        font-size: 16px;
                        outline: none;
                        margin-bottom: 12px;
                    "
                >

                <button
                    type="submit"
                    style="
                        width: 100%;
                        padding: 14px;
                        border: 0;
                        border-radius: 10px;
                        background: #fff;
                        color: #000;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                    "
                >
                    Unlock Gallery
                </button>

                <p
                    id="galleryPasswordError"
                    style="
                        display: none;
                        color: #ff5c5c;
                        margin: 14px 0 0;
                        font-size: 14px;
                    "
                ></p>
            </form>
        </div>
    `;

    document.body.appendChild(
        screen
    );

    const form =
        document.querySelector(
            "#galleryPasswordForm"
        );

    const input =
        document.querySelector(
            "#galleryPasswordInput"
        );

    const error =
        document.querySelector(
            "#galleryPasswordError"
        );

    form.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const password =
                input.value.trim();

            if (!password) {
                error.textContent =
                    "Please enter the password.";

                error.style.display =
                    "block";

                return;
            }

            error.style.display =
                "none";

            const button =
                form.querySelector(
                    "button"
                );

            button.disabled = true;

            button.textContent =
                "Checking...";

            try {
                const response =
                    await fetch(
                        `${API}/auth/gallery`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify({
                                    password
                                })
                        }
                    );

                const data =
                    await response.json();

                if (
                    !response.ok ||
                    !data.token
                ) {
                    throw new Error(
                        data.error ||
                        "Incorrect password"
                    );
                }

                sessionStorage.setItem(
                    GALLERY_TOKEN_KEY,
                    data.token
                );

                screen.remove();

                await loadGallery();

            } catch (err) {
                error.textContent =
                    err.message ||
                    "Incorrect password.";

                error.style.display =
                    "block";

                input.value = "";
                input.focus();

                button.disabled =
                    false;

                button.textContent =
                    "Unlock Gallery";
            }
        }
    );

    setTimeout(() => {
        input.focus();
    }, 50);
}


/* =========================
   TOKEN
   ========================= */

function getGalleryToken() {
    return sessionStorage.getItem(
        GALLERY_TOKEN_KEY
    );
}


/* =========================
   IMAGE URL
   ========================= */

function imageURL(id) {
    const token =
        getGalleryToken();

    return (
        `${API}/?id=${encodeURIComponent(id)}` +
        `&access_token=${encodeURIComponent(token)}`
    );
}


/* =========================
   LOAD GALLERY
   ========================= */

async function loadGallery() {
    const token =
        getGalleryToken();

    if (!token) {
        showPasswordScreen();
        return;
    }

    try {
        const response =
            await fetch(
                `${API}/gallery`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    },
                    cache: "no-store"
                }
            );

        if (
            response.status === 401
        ) {
            sessionStorage.removeItem(
                GALLERY_TOKEN_KEY
            );

            showPasswordScreen();

            return;
        }

        if (!response.ok) {
            throw new Error(
                `Gallery API returned ${response.status}`
            );
        }

        images =
            await response.json();

        filteredImages =
            [...images];

        renderGallery();

    } catch (error) {
        console.error(
            "Gallery error:",
            error
        );

        empty.textContent =
            "Could not load Cloud Gallery.";

        empty.style.display =
            "block";
    }
}


/* =========================
   RENDER GALLERY
   ========================= */

function renderGallery() {
    grid.innerHTML = "";

    if (!filteredImages.length) {
        empty.style.display =
            "block";

        return;
    }

    empty.style.display =
        "none";

    filteredImages.forEach(
        (image, index) => {
            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "gallery-item";

            const img =
                document.createElement(
                    "img"
                );

            img.src =
                imageURL(image.id);

            img.alt =
                image.title;

            img.loading =
                "lazy";

            card.appendChild(
                img
            );

            card.addEventListener(
                "click",
                () => {
                    openViewer(index);
                }
            );

            grid.appendChild(
                card
            );
        }
    );
}


/* =========================
   IMAGE VIEWER
   ========================= */

function openViewer(index) {
    currentIndex =
        index;

    const image =
        filteredImages[
            currentIndex
        ];

    viewerImage.src =
        imageURL(image.id);

    viewerImage.alt =
        image.title;

    viewerTitle.textContent =
        image.filename;

    viewer.classList.add(
        "show"
    );
}


function closeImageViewer() {
    viewer.classList.remove(
        "show"
    );

    viewerImage.src =
        "";
}


function showPrevious() {
    if (
        !filteredImages.length
    ) {
        return;
    }

    currentIndex =
        (
            currentIndex -
            1 +
            filteredImages.length
        ) %
        filteredImages.length;

    openViewer(
        currentIndex
    );
}


function showNext() {
    if (
        !filteredImages.length
    ) {
        return;
    }

    currentIndex =
        (
            currentIndex +
            1
        ) %
        filteredImages.length;

    openViewer(
        currentIndex
    );
}


/* =========================
   SEARCH
   ========================= */

search.addEventListener(
    "input",
    () => {
        const query =
            search.value
                .toLowerCase()
                .trim();

        filteredImages =
            images.filter(
                image =>
                    image.filename
                        .toLowerCase()
                        .includes(query)
            );

        renderGallery();
    }
);


/* =========================
   VIEWER CONTROLS
   ========================= */

closeViewer.addEventListener(
    "click",
    closeImageViewer
);

prevImage.addEventListener(
    "click",
    showPrevious
);

nextImage.addEventListener(
    "click",
    showNext
);

viewer.addEventListener(
    "click",
    event => {
        if (
            event.target ===
            viewer
        ) {
            closeImageViewer();
        }
    }
);


/* =========================
   KEYBOARD CONTROLS
   ========================= */

document.addEventListener(
    "keydown",
    event => {
        if (
            !viewer.classList.contains(
                "show"
            )
        ) {
            return;
        }

        if (
            event.key === "Escape"
        ) {
            closeImageViewer();
        }

        if (
            event.key === "ArrowLeft"
        ) {
            showPrevious();
        }

        if (
            event.key === "ArrowRight"
        ) {
            showNext();
        }
    }
);


/* =========================
   START
   ========================= */

loadGallery();