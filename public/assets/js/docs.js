/* Docs page: copy buttons, starter-operator toggles, contents filter and scroll tracking. */
(function () {
    "use strict";

    const prelude = (document.getElementById("prelude") || {}).textContent || "";

    // Copy: copies the example, plus the starter operators when they are shown.
    document.addEventListener("click", async (e) => {
        const copy = e.target.closest(".copy");
        if (copy) {
            const fig = copy.closest(".code");
            const main = fig.querySelector("pre.main") || fig.querySelector("pre");
            let text = main.textContent;
            if (fig.hasAttribute("data-prelude") && fig.classList.contains("show-prelude")) text = prelude + "\n\n" + text;
            const label = copy.querySelector("span");
            try {
                await navigator.clipboard.writeText(text);
                label.textContent = "Copied";
            } catch (_) {
                label.textContent = "Press Ctrl+C";
                const range = document.createRange();
                range.selectNodeContents(main);
                getSelection().removeAllRanges();
                getSelection().addRange(range);
            }
            setTimeout(() => { label.textContent = "Copy"; }, 1600);
            return;
        }

        const toggle = e.target.closest(".prelude-toggle");
        if (toggle) {
            const fig = toggle.closest(".code");
            const on = fig.classList.toggle("show-prelude");
            toggle.setAttribute("aria-expanded", String(on));
        }
    });

    // Contents: filter, mobile toggle, highlight the section in view.
    const toc = document.getElementById("toc");
    const search = document.getElementById("toc-search");
    const toggle = document.getElementById("toc-toggle");
    if (!toc) return;

    const items = [...toc.querySelectorAll("li")];
    search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        toc.classList.toggle("searching", !!q);
        let any = false;
        for (const li of items) {
            const own = li.firstElementChild.textContent.toLowerCase().includes(q);
            const child = [...li.querySelectorAll(".lvl3 > a")].some((a) => a.textContent.toLowerCase().includes(q));
            const show = !q || own || child;
            li.hidden = !show;
            any ||= show;
        }
        if (q) for (const li of toc.querySelectorAll(".lvl2")) {
            // a matching section shows all its subsections
            if (li.firstElementChild.textContent.toLowerCase().includes(q)) li.querySelectorAll("li").forEach((c) => (c.hidden = false));
        }
        let empty = toc.querySelector(".empty");
        if (!any && !empty) {
            empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = "No section matches. Try a shorter word.";
            toc.querySelector("nav").appendChild(empty);
        } else if (any && empty) empty.remove();
    });

    if (toggle) {
        toggle.addEventListener("click", () => {
            const open = toc.classList.toggle("open");
            toggle.setAttribute("aria-expanded", String(open));
        });
        toc.addEventListener("click", (e) => {
            if (e.target.closest("a") && toc.classList.contains("open")) {
                toc.classList.remove("open");
                toggle.setAttribute("aria-expanded", "false");
            }
        });
    }

    const links = new Map([...toc.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]));
    const heads = [...document.querySelectorAll(".doc h2[id], .doc h3[id]")];
    let active = null;
    function track() {
        const y = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 80) + 10;
        let cur = heads[0];
        for (const h of heads) {
            if (h.getBoundingClientRect().top <= y) cur = h;
            else break;
        }
        const a = cur && links.get(cur.id);
        if (a === active) return;
        if (active) active.classList.remove("active");
        toc.querySelectorAll("li.open").forEach((li) => li.classList.remove("open"));
        active = a;
        if (!a) return;
        a.classList.add("active");
        const sec = a.closest(".lvl2");
        if (sec) sec.classList.add("open");
        const r = a.getBoundingClientRect(), tr = toc.getBoundingClientRect();
        if (r.top < tr.top + 60 || r.bottom > tr.bottom - 20) a.scrollIntoView({ block: "nearest" });
    }
    let raf = 0;
    addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; track(); }); }, { passive: true });
    track();
})();
