/* Shared page behavior: theme toggle, mobile nav, small helpers. */
(function () {
    "use strict";

    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
    };
    window.PieStore = store;

    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : media.matches);

    function syncThemeButton() {
        const btn = document.getElementById("theme-toggle");
        if (!btn) return;
        const dark = isDark();
        btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
        btn.querySelector(".i-sun").style.display = dark ? "block" : "none";
        btn.querySelector(".i-moon").style.display = dark ? "none" : "block";
    }

    document.addEventListener("DOMContentLoaded", () => {
        const btn = document.getElementById("theme-toggle");
        if (btn) {
            btn.addEventListener("click", () => {
                const next = isDark() ? "light" : "dark";
                root.dataset.theme = next;
                store.set("pie-theme", next);
                syncThemeButton();
            });
        }
        media.addEventListener?.("change", syncThemeButton);
        syncThemeButton();

        const nav = document.querySelector(".site-nav");
        const toggle = document.getElementById("nav-toggle");
        if (nav && toggle) {
            toggle.addEventListener("click", () => {
                const open = nav.classList.toggle("open");
                toggle.setAttribute("aria-expanded", String(open));
            });
        }
    });

    // ---- latest release ----------------------------------------------------
    // Fills every [data-pie-version] (link: "Latest: v1.2.3") and
    // [data-pie-version-text] (plain text: "v1.2.3") from GitHub's latest release.
    // Cached for an hour per visitor; if GitHub can't be reached, nothing changes.
    const RELEASES_API = "https://api.github.com/repos/AliAlmutawaJr/Pie/releases/latest";
    const VERSION_KEY = "pie-latest-release";

    async function latestRelease() {
        try {
            const cached = JSON.parse(sessionStorage.getItem(VERSION_KEY) || "null");
            if (cached && Date.now() - cached.at < 3600e3) return cached;
        } catch (_) { /* storage blocked */ }

        const res = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
        if (!res.ok) throw new Error("GitHub said " + res.status);
        const data = await res.json();
        // Tags look like "Release-1.11.1-…" or "v1.11.1": take the first x.y(.z).
        const m = String(data.tag_name || "").match(/\d+(?:\.\d+)+/) || String(data.name || "").match(/\d+(?:\.\d+)+/);
        if (!m) throw new Error("no version in " + data.tag_name);
        const release = { version: "v" + m[0], url: data.html_url, at: Date.now() };
        try { sessionStorage.setItem(VERSION_KEY, JSON.stringify(release)); } catch (_) {}
        return release;
    }

    document.addEventListener("DOMContentLoaded", () => {
        const links = document.querySelectorAll("[data-pie-version]");
        const texts = document.querySelectorAll("[data-pie-version-text]");
        if (!links.length && !texts.length) return;
        latestRelease().then(({ version, url }) => {
            for (const a of links) {
                a.textContent = "Latest: " + version;
                if (url) a.href = url;
                a.hidden = false;
            }
            for (const t of texts) t.textContent = version;
        }).catch(() => { /* leave the page as it is */ });
    });

    // Playground links carry code in the URL hash, base64url-encoded UTF-8.
    window.PieShare = {
        encode(code) {
            const bytes = new TextEncoder().encode(code);
            let bin = "";
            for (const b of bytes) bin += String.fromCharCode(b);
            return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        },
        decode(s) {
            const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
            const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
            return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
        },
        link(code) {
            return new URL("playground.html#code=" + this.encode(code), document.baseURI).href;
        },
    };

    // ANSI colour codes (as printed by Pie's error renderer) -> HTML.
    const ANSI = {
        30: "#4A3427", 31: "#FF8A80", 32: "#9AD69B", 33: "#F2CF6B", 34: "#A9B4FF",
        35: "#E0A8F5", 36: "#85C8F0", 37: "#F7EBDD",
        90: "#A08F82", 91: "#FF9C94", 92: "#B5E8B0", 93: "#FFE08A", 94: "#C3CAFF",
        95: "#EBC2FA", 96: "#A6DAF7", 97: "#FFFFFF",
    };
    window.ansiToHtml = function (text) {
        const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let out = "", bold = false, color = null;
        const parts = String(text).replace(/\0/g, "").split(/\x1b\[([0-9;]*)m/);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                if (!parts[i]) continue;
                const style = (bold ? "font-weight:700;" : "") + (color ? `color:${color};` : "");
                out += style ? `<span style="${style}">${esc(parts[i])}</span>` : esc(parts[i]);
            } else {
                for (const code of (parts[i] || "0").split(";").map(Number)) {
                    if (code === 0) { bold = false; color = null; }
                    else if (code === 1) bold = true;
                    else if (code === 22) bold = false;
                    else if (code === 39) color = null;
                    else if (ANSI[code]) color = ANSI[code];
                }
            }
        }
        return out;
    };
})();
