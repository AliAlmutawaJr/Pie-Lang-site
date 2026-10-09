/* Home page: the changing operator in the tagline, and the live example card. */
(function () {
    "use strict";

    // ---- the operator in "even + is yours to define" ----
    // Single characters only, so the line never reflows. Each one is a valid
    // Pie operator name (the lexer rejects non-ASCII symbols such as ± and §).
    const OPS = ["+", "-", "*", "/", "%", "^", "!", "~", "&", "|", "?", "\\", "$", "#", "@", "'"];
    const opSlot = document.querySelector(".op-cycle span");
    if (opSlot) {
        let i = 0;
        setInterval(() => {
            if (document.hidden) return;
            i = (i + 1) % OPS.length;
            opSlot.classList.add("leaving");
            setTimeout(() => {
                opSlot.textContent = OPS[i];
                opSlot.classList.remove("leaving");
                opSlot.classList.add("entering");
                void opSlot.offsetWidth; // apply the start position before animating in
                opSlot.classList.remove("entering");
            }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
        }, 2000);
    }

    const PICKS = ["operators", "if", "quirks", "match", "packs"];
    const examples = (window.PIE_EXAMPLES || []).filter((e) => PICKS.includes(e.id))
        .sort((a, b) => PICKS.indexOf(a.id) - PICKS.indexOf(b.id));
    const SHORT = { operators: "Operators", if: "Your own if", quirks: "2 + 2 = 5", match: "Matching", packs: "Packs" };

    const tabs = document.querySelector(".oven-tabs");
    const code = document.querySelector("#oven-code code");
    const out = document.getElementById("oven-out");
    const runBtn = document.getElementById("oven-run");
    const open = document.getElementById("oven-open");
    const status = document.getElementById("oven-status");
    if (!tabs || !examples.length) return;

    let current = examples[0];
    let running = null;

    function select(ex, focus) {
        current = ex;
        for (const b of tabs.children) {
            const on = b.dataset.id === ex.id;
            b.setAttribute("aria-selected", String(on));
            b.tabIndex = on ? 0 : -1;
            if (on && focus) b.focus();
        }
        code.innerHTML = PieHighlight.highlight(ex.code);
        open.href = PieShare.link(ex.code);
        if (running) running.stop();
        out.textContent = "";
        status.textContent = "";
    }

    examples.forEach((ex) => {
        const b = document.createElement("button");
        b.type = "button";
        b.role = "tab";
        b.dataset.id = ex.id;
        b.textContent = SHORT[ex.id] || ex.title;
        b.addEventListener("click", () => select(ex));
        tabs.appendChild(b);
    });

    tabs.addEventListener("keydown", (e) => {
        const i = examples.indexOf(current);
        if (e.key === "ArrowRight") select(examples[(i + 1) % examples.length], true);
        else if (e.key === "ArrowLeft") select(examples[(i - 1 + examples.length) % examples.length], true);
    });

    runBtn.addEventListener("click", () => {
        if (running) running.stop();
        out.textContent = "";
        status.textContent = "Baking…";
        runBtn.disabled = true;
        const append = (type, text) => {
            const span = document.createElement("span");
            if (type !== "out") span.style.color = type === "err" ? "#FF9C94" : "#A08F82";
            span.innerHTML = ansiToHtml(text);
            out.appendChild(span);
        };
        running = PieRunner.run(current.code, {
            interactive: false,
            onOutput: append,
            onDone: (info) => {
                running = null;
                runBtn.disabled = false;
                status.textContent = info.ms !== undefined ? `Done in ${Math.max(1, Math.round(info.ms))} ms` : "";
            },
        });
    });

    select(examples[0]);
    // warm the compiler cache while the visitor reads
    if ("requestIdleCallback" in window) requestIdleCallback(() => PieRunner.preload().catch(() => {}));
})();
