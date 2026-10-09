/* Spec page: renders spec.md from the Pie repository. */
(function () {
    "use strict";
    const URL_ = "https://raw.githubusercontent.com/AliAlmutawaJr/Pie/main/spec.md";
    const status = document.getElementById("spec-status");
    const target = document.getElementById("spec");

    fetch(URL_, { cache: "no-cache" })
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then((md) => {
            target.innerHTML = marked.parse(md);
            status.remove();
            for (const code of target.querySelectorAll("pre code")) {
                const pre = code.parentElement;
                const fig = document.createElement("figure");
                const isPie = code.className.includes("language-pie");
                fig.className = isPie ? "code" : "code plain";
                pre.replaceWith(fig);
                fig.appendChild(pre);
                if (isPie) code.innerHTML = PieHighlight.highlight(code.textContent);
            }
            for (const t of target.querySelectorAll("table")) {
                const w = document.createElement("div");
                w.className = "table-wrap";
                t.replaceWith(w);
                w.appendChild(t);
            }
            const used = new Set();
            for (const h of target.querySelectorAll("h1, h2, h3, h4")) {
                let id = h.textContent.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
                while (used.has(id)) id += "-";
                used.add(id);
                h.id = id;
            }
            if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
        })
        .catch((e) => {
            status.innerHTML = 'Couldn\'t load the specification (' + e.message + '). Read <a href="https://github.com/AliAlmutawaJr/Pie/blob/main/spec.md">spec.md on GitHub</a> instead.';
        });
})();
