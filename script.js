"use strict";

/*
|--------------------------------------------------------------------------
| APK VAULT — STORE ENGINE  (Simplified)
|--------------------------------------------------------------------------
| - Only search (no category/sort/filters)
| - Apps sorted by releaseDate (newest first)
| - SHA-256 hash shown in detail page
|--------------------------------------------------------------------------
*/


/* ==========================================================================
   CONFIG
   ========================================================================== */

const STORE = {
    dataFile: new URL("app.json", document.baseURI).href,
    appPage: "app.html"
};


/* ==========================================================================
   STATE
   ========================================================================== */

const state = {
    apps: [],
    filteredApps: [],
    search: ""
};


/* ==========================================================================
   DOM HELPERS
   ========================================================================== */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


/* ==========================================================================
   SVG ICONS
   ========================================================================== */

const icons = {
    menu: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16"/>
            <path d="M4 12h16"/>
            <path d="M4 17h16"/>
        </svg>
    `,
    close: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12"/>
            <path d="M18 6L6 18"/>
        </svg>
    `,
    search: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-4-4"/>
        </svg>
    `,
    download: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12"/>
            <path d="m7 10 5 5 5-5"/>
            <path d="M5 21h14"/>
        </svg>
    `,
    arrow: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14"/>
            <path d="m13 6 6 6-6 6"/>
        </svg>
    `,
    star: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" stroke="none"
                d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z"/>
        </svg>
    `,
    warning: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.3 3.8 2.9 17a2 2 0 0 0 1.75 3h14.7a2 2 0 0 0 1.75-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
        </svg>
    `,
    check: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6"/>
        </svg>
    `,
    chevronUp: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m18 15-6-6-6 6"/>
        </svg>
    `
};


/* ==========================================================================
   BOOT
   ========================================================================== */

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
    setupMenu();
    setupSearch();
    setupGlobalLinks();
    setupScrollHeader();
    setupBackToTop();
    setupScrollReveal();
    await loadStore();
    setupAppPage();
}


/* ==========================================================================
   LOAD STORE
   ========================================================================== */

async function loadStore() {
    const container = getAppsContainer();
    if (container) renderSkeleton(container, 4);

    try {
        const url = STORE.dataFile;
        console.log("APK Vault → Loading:", url);

        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json") && !contentType.includes("text/plain")) {
            console.warn("APK Vault → Unexpected content type:", contentType);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
            state.apps = data;
        } else if (data && Array.isArray(data.apps)) {
            state.apps = data.apps;
        } else {
            throw new Error("Invalid app.json structure.");
        }

        state.apps = state.apps.filter(Boolean).map(normalizeApp).filter(app => app.id);
        console.log(`APK Vault → ${state.apps.length} apps loaded`);

        // ترتيب التطبيقات حسب تاريخ الإصدار (الأحدث أولاً) قبل العرض
        state.apps.sort((a, b) => {
            const dateA = new Date(a.releaseDate || '1970-01-01');
            const dateB = new Date(b.releaseDate || '1970-01-01');
            return dateB - dateA;
        });

        renderStore();

    } catch (error) {
        console.error("APK Vault → Store loading failed:", error);
        renderFatalError(error);
    }
}


/* ==========================================================================
   NORMALIZE APP (إضافة hash و releaseDate)
   ========================================================================== */

function normalizeApp(app) {
    return {
        id: String(app.id || "").trim(),
        name: String(app.name || "Unnamed App"),
        description: String(app.description || "No description available."),
        longDescription: String(app.longDescription || app.description || ""),
        category: String(app.category || "Other"),
        version: String(app.version || "Unknown"),
        size: String(app.size || "Unknown"),
        rating: Number(app.rating) || 0,
        downloads: Number(app.downloads) || 0,
        android: String(app.android || "Android"),
        developer: String(app.developer || "Independent Developer"),
        updated: String(app.updated || ""),
        redistributable: Boolean(app.redistributable),
        icon: String(app.icon || ""),
        apk: String(app.apk || ""),
        featured: Boolean(app.featured),
        screenshots: Array.isArray(app.screenshots) ? app.screenshots : [],
        features: Array.isArray(app.features) ? app.features : [],
        tags: Array.isArray(app.tags) ? app.tags : [],
        hash: String(app.hash || ""),           // <-- جديد
        releaseDate: String(app.releaseDate || app.updated || "1970-01-01") // <-- جديد
    };
}


/* ==========================================================================
   RENDER STORE (البحث فقط)
   ========================================================================== */

function renderStore() {
    applySearch();  // تطبيق البحث (بدون تصنيف أو ترتيب)
    renderFeatured();
}


/* ==========================================================================
   APPLY SEARCH (بدلاً من applyFilters)
   ========================================================================== */

function applySearch() {
    const search = state.search.toLowerCase().trim();

    const filtered = state.apps.filter(app => {
        const searchable = [
            app.name,
            app.description,
            app.category,
            app.developer,
            ...app.tags
        ].join(" ").toLowerCase();
        return !search || searchable.includes(search);
    });

    state.filteredApps = filtered;
    renderApps(filtered);
    updateCount(filtered.length);
}


/* ==========================================================================
   SEARCH SETUP
   ========================================================================== */

function setupSearch() {
    const inputs = $$("#search, #searchInput, .search-input");
    inputs.forEach(input => {
        input.addEventListener("input", event => {
            state.search = event.target.value;
            inputs.forEach(other => {
                if (other !== event.target) other.value = event.target.value;
            });
            applySearch();
        });
    });
}


/* ==========================================================================
   RENDER APPS
   ========================================================================== */

function renderApps(appList) {
    const container = getAppsContainer();
    if (!container) return;

    if (!appList.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icons.search}</div>
                <h3>No applications found</h3>
                <p>Try another search term.</p>
                <button type="button" class="clear-search" data-clear-filters>Clear search</button>
            </div>
        `;
        return;
    }

    container.innerHTML = appList.map(createCard).join("");
}


/* ==========================================================================
   SKELETON
   ========================================================================== */

function renderSkeleton(container, count) {
    const skeletons = Array.from({ length: count }, () => `
        <div class="skeleton-card">
            <div class="skel-row">
                <div class="skel-icon"></div>
                <div class="skel-lines">
                    <div class="skel-line"></div>
                    <div class="skel-line"></div>
                    <div class="skel-line"></div>
                </div>
            </div>
            <div class="skel-footer"></div>
        </div>
    `).join("");
    container.innerHTML = skeletons;
}


/* ==========================================================================
   CARD
   ========================================================================== */

function createCard(app) {
    const id = encodeURIComponent(app.id);
    const rating = app.rating ? app.rating.toFixed(1) : "—";

    return `
        <article class="app-card" data-app-id="${escapeAttr(app.id)}">
            <a class="app-card-main" href="${STORE.appPage}?id=${id}">
                <div class="app-card-icon">
                    ${app.icon ? `<img src="${escapeAttr(app.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
                </div>
                <div class="app-card-content">
                    <div class="app-card-title-row">
                        <h3>${escapeHTML(app.name)}</h3>
                        ${app.featured ? `<span class="featured-badge">Featured</span>` : ""}
                    </div>
                    <p>${escapeHTML(app.description)}</p>
                    <div class="app-card-meta">
                        <span>${escapeHTML(app.category)}</span>
                        <span class="rating">${icons.star} ${rating}</span>
                    </div>
                </div>
            </a>
            <div class="app-card-footer">
                <span>${formatNumber(app.downloads)} downloads</span>
                <span class="app-card-arrow">${icons.arrow}</span>
            </div>
        </article>
    `;
}


/* ==========================================================================
   FEATURED
   ========================================================================== */

function renderFeatured() {
    const container = $("#featuredApps, .featured-apps, .featured-grid");
    if (!container) return;
    let featured = state.apps.filter(app => app.featured);
    if (!featured.length) featured = state.apps.slice(0, 4);
    container.innerHTML = featured.slice(0, 6).map(createCard).join("");
}


/* ==========================================================================
   APP DETAIL PAGE
   ========================================================================== */

function setupAppPage() {
    if (!location.pathname.toLowerCase().endsWith("app.html")) return;
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (!id) { renderAppNotFound(); return; }
    const app = state.apps.find(item => item.id.toLowerCase() === id.toLowerCase());
    if (!app) { renderAppNotFound(); return; }
    renderAppDetailPage(app);
}

function renderAppDetailPage(app) {
    const container = $("#appContent");
    if (!container) return;

    const features = (app.features || []).map(feature => `
        <li>${icons.check} ${escapeHTML(feature)}</li>
    `).join("");

    const screenshots = (app.screenshots || []).map((image, i) => `
        <img src="${escapeAttr(image)}" alt="${escapeAttr(app.name)} screenshot ${i+1}" loading="lazy">
    `).join("");

    const redistributionText = app.redistributable ? "Allowed under distribution policy" : "Not permitted";

    container.innerHTML = `
        <div class="app-hero">
            <div class="app-main-icon">
                ${app.icon ? `<img src="${escapeAttr(app.icon)}" alt="${escapeAttr(app.name)}">` : ""}
            </div>
            <div class="app-main-info">
                <div class="app-category">${escapeHTML(app.category)}</div>
                <h1>${escapeHTML(app.name)}</h1>
                <p>${escapeHTML(app.description)}</p>
                <div class="app-stats">
                    <span><strong>${app.rating ? app.rating.toFixed(1) : "—"}</strong> Rating</span>
                    <span><strong>${formatNumber(app.downloads)}</strong> Downloads</span>
                    <span><strong>${escapeHTML(app.size)}</strong> Size</span>
                </div>
                <a href="${escapeAttr(app.apk)}" class="main-download" download ${!app.apk ? 'style="pointer-events:none;opacity:.5"' : ""}>
                    ${app.apk ? "Download APK" : "APK unavailable"} ${app.apk ? icons.download : ""}
                </a>
            </div>
        </div>

        <section class="app-details">
            <div class="details-main">
                <h2>About this app</h2>
                <p>${escapeHTML(app.longDescription)}</p>
                <h2>Features</h2>
                <ul class="features-list">${features}</ul>
            </div>
            <aside class="app-info-panel">
                <h3>Information</h3>
                <div class="info-row"><span>Developer</span><strong>${escapeHTML(app.developer)}</strong></div>
                <div class="info-row"><span>Version</span><strong>${escapeHTML(app.version)}</strong></div>
                <div class="info-row"><span>Size</span><strong>${escapeHTML(app.size)}</strong></div>
                <div class="info-row"><span>Android</span><strong>${escapeHTML(app.android)}</strong></div>
                <div class="info-row"><span>Updated</span><strong>${escapeHTML(app.updated)}</strong></div>
                <div class="info-row"><span>Redistribution</span><strong>${redistributionText}</strong></div>
                <!-- إضافة SHA-256 -->
                <div class="info-row"><span>SHA-256</span><strong style="font-size:10px;word-break:break-all;">${escapeHTML(app.hash || 'غير متوفر')}</strong></div>
            </aside>
        </section>

        <section class="screenshots-section">
            <h2>Screenshots</h2>
            <div class="screenshots">
                ${screenshots || `<p class="empty-state">Screenshots coming soon.</p>`}
            </div>
        </section>

        <section class="app-distribution">
            <div>
                <p class="section-label"><span></span> DISTRIBUTION</p>
                <h2>Want to share this app?</h2>
                <p>Redistribution may be allowed under the APKVault distribution policy.</p>
            </div>
            <a href="distribution.html" class="hero-secondary">View Policy</a>
        </section>
    `;

    document.title = `${app.name} — APKVault`;
}

function renderAppNotFound() {
    const container = $("#appContent");
    if (!container) return;
    container.innerHTML = `
        <div class="page-error">
            <h1>Application not found</h1>
            <p>This application does not exist in APK Vault.</p>
            <a href="index.html" class="download-btn">Back to store</a>
        </div>
    `;
}


/* ==========================================================================
   MOBILE MENU
   ========================================================================== */

function setupMenu() {
    const button = $("#menuBtn, #mobileMenu, .mobile-menu");
    const nav = $("#mainNav");
    if (!button || !nav) return;

    button.addEventListener("click", e => {
        e.preventDefault();
        const open = nav.classList.toggle("open");
        button.setAttribute("aria-expanded", String(open));
        document.body.classList.toggle("menu-open", open);
    });

    $$("a", nav).forEach(link => {
        link.addEventListener("click", () => {
            nav.classList.remove("open");
            button.setAttribute("aria-expanded", "false");
            document.body.classList.remove("menu-open");
        });
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            nav.classList.remove("open");
            button.setAttribute("aria-expanded", "false");
            document.body.classList.remove("menu-open");
        }
    });
}


/* ==========================================================================
   GLOBAL LINKS & CLEAR SEARCH
   ========================================================================== */

function setupGlobalLinks() {
    $$('a[href^="#"]').forEach(link => {
        link.addEventListener("click", e => {
            const targetId = link.getAttribute("href");
            if (!targetId || targetId === "#") return;
            const target = $(targetId);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth" });
        });
    });

    document.addEventListener("click", e => {
        if (e.target.matches("[data-clear-filters]")) {
            state.search = "";
            $$("#search, #searchInput, .search-input").forEach(input => input.value = "");
            applySearch();
        }
    });
}


/* ==========================================================================
   SCROLL HEADER
   ========================================================================== */

function setupScrollHeader() {
    const header = $("header");
    if (!header) return;
    const update = () => header.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", update, { passive: true });
    update();
}


/* ==========================================================================
   BACK TO TOP
   ========================================================================== */

function setupBackToTop() {
    const btn = document.createElement("button");
    btn.className = "back-to-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.innerHTML = icons.chevronUp;
    document.body.appendChild(btn);

    window.addEventListener("scroll", () => {
        btn.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });

    btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}


/* ==========================================================================
   SCROLL REVEAL
   ========================================================================== */

function setupScrollReveal() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("revealed");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    $$(".reveal").forEach(el => observer.observe(el));
    window.__revealObserver = observer;
}

function observeNewRevealElements() {
    const observer = window.__revealObserver;
    if (!observer) return;
    $$(".reveal:not(.revealed)").forEach(el => observer.observe(el));
}

// Override renderApps لتفعيل الـ reveal على البطاقات الجديدة
const _origRenderApps = renderApps;
renderApps = function(appList) {
    _origRenderApps(appList);
    requestAnimationFrame(() => observeNewRevealElements());
};


/* ==========================================================================
   ERROR
   ========================================================================== */

function renderFatalError(error) {
    const container = getAppsContainer();
    if (!container) return;
    container.innerHTML = `
        <div class="load-error">
            <div class="load-error-icon">${icons.warning}</div>
            <h2>APK Vault could not load</h2>
            <p>The application catalog could not be loaded.</p>
            <code>${escapeHTML(error.message)}</code>
            <button type="button" data-retry>Retry</button>
        </div>
    `;
    const retry = $("[data-retry]", container);
    if (retry) retry.addEventListener("click", loadStore);
}


/* ==========================================================================
   HELPERS
   ========================================================================== */

function getAppsContainer() {
    return $("#appsGrid, .apps-grid, .apps-container");
}

function updateCount(count) {
    const element = $("#resultCount, [data-results-count]");
    if (element) {
        element.textContent = `${count} app${count === 1 ? "" : "s"}`;
    }
}

function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number.toLocaleString() : "0";
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
    return escapeHTML(value);
}
