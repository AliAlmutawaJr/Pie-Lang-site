/* Playground page: editor, examples, running, sharing, the output console and the Program input box. */
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const runBtn = $("run"), stopBtn = $("stop"), select = $("examples"), shareBtn = $("share");
    const output = $("output"), status = $("status"), clearBtn = $("clear");
    const inputPane = $("input-pane"), inputToggle = $("toggle-input"), stdin = $("stdin");
    const examples = window.PIE_EXAMPLES || [];
    const DRAFT_KEY = "pie-playground-draft";
    const INPUT_KEY = "pie-playground-input";

    // ---- what to show first: shared link > saved draft > first example ----
    let initial = null, fromExample = "";
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get("code")) {
        try { initial = PieShare.decode(hash.get("code")); } catch (_) { initial = null; }
    } else if (hash.get("example")) {
        const ex = examples.find((e) => e.id === hash.get("example"));
        if (ex) { initial = ex.code; fromExample = ex.id; }
    }
    if (initial === null) {
        const draft = PieStore.get(DRAFT_KEY);
        if (draft) initial = draft;
    }
    if (initial === null && examples.length) { initial = examples[0].code; fromExample = examples[0].id; }

    for (const ex of examples) {
        const o = document.createElement("option");
        o.value = ex.id;
        o.textContent = ex.title;
        select.appendChild(o);
    }
    select.value = fromExample;

    let saveTimer = 0;
    let settingExample = false;
    const editor = new PieEditor($("editor"), {
        value: initial || "",
        label: "Pie code",
        onRun: () => run(),
        onChange: (text) => {
            if (!settingExample) select.value = "";
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => PieStore.set(DRAFT_KEY, text), 400);
        },
    });

    select.addEventListener("change", () => {
        const ex = examples.find((e) => e.id === select.value);
        if (!ex) return;
        settingExample = true;
        editor.setValue(ex.code);
        settingExample = false;
        history.replaceState(null, "", "#example=" + ex.id);
        editor.focus();
    });

    // ---- output console ----
    // Output arrives as raw chunks (not always whole lines), so a prompt printed
    // with `end = ""` stays on the same line as the answer typed after it.
    let placeholder = true;
    let wroteAnything = false;
    // Output is queued and drawn once per frame, so a program printing in a
    // tight loop can't freeze the page. Only the last ~60k characters are kept.
    const KEEP = 60000;
    let queue = [];
    let queued = 0;
    let shown = 0;
    let frame = 0;

    function write(type, text) {
        if (!text) return;
        if (placeholder) { output.textContent = ""; placeholder = false; }
        wroteAnything = true;
        const last = queue[queue.length - 1];
        if (last && last.type === type) last.text += text;
        else queue.push({ type, text });
        queued += text.length;
        if (queued > KEEP * 2) { // tab in the background: drop the oldest queued text
            while (queue.length > 1 && queued - queue[0].text.length > KEEP) queued -= queue.shift().text.length;
        }
        if (!frame) frame = requestAnimationFrame(render);
    }

    function render() {
        cancelAnimationFrame(frame);
        frame = 0;
        if (!queue.length) return;
        const stick = output.scrollHeight - output.scrollTop - output.clientHeight < 40;
        const frag = document.createDocumentFragment();
        for (const { type, text } of queue) {
            const span = document.createElement("span");
            if (type !== "out") span.className = type;
            const tail = text.length > KEEP ? text.slice(-KEEP) : text;
            if (tail.includes("\x1b")) span.innerHTML = ansiToHtml(tail);
            else span.textContent = tail;
            frag.appendChild(span);
            shown += Math.min(text.length, KEEP);
        }
        queue = [];
        queued = 0;
        output.insertBefore(frag, field.isConnected ? field : null);
        if (shown > KEEP * 1.5) trim();
        if (stick) output.scrollTop = output.scrollHeight;
    }

    function trim() {
        while (shown > KEEP && output.firstChild && output.firstChild !== field) {
            shown -= (output.firstChild.textContent || "").length;
            output.removeChild(output.firstChild);
        }
        const note = document.createElement("span");
        note.className = "note";
        note.textContent = "(earlier output trimmed)\n";
        output.insertBefore(note, output.firstChild);
    }

    function resetOutput() {
        cancelAnimationFrame(frame);
        frame = 0;
        queue = [];
        queued = 0;
        shown = 0;
        for (const n of [...output.childNodes]) if (n !== field) n.remove();
    }

    // ---- Program input box: answers the first reads, one line each ----
    const savedInput = PieStore.get(INPUT_KEY);
    if (savedInput) stdin.value = savedInput;
    function showInput(open) {
        inputPane.dataset.collapsed = String(!open);
        inputToggle.textContent = open ? "Hide" : "Show";
        inputToggle.setAttribute("aria-expanded", String(open));
    }
    inputToggle.addEventListener("click", () => showInput(inputPane.dataset.collapsed === "true"));
    stdin.addEventListener("input", () => PieStore.set(INPUT_KEY, stdin.value));
    if (stdin.value) showInput(true);

    // The input line: a text field placed right after the program's output.
    const field = document.createElement("input");
    field.className = "term-input";
    field.type = "text";
    field.autocomplete = "off";
    field.spellcheck = false;
    field.setAttribute("aria-label", "Input for your program. Press Enter to send it.");
    let answer = null;

    function askForInput(reply) {
        render(); // the prompt goes before the field
        answer = reply;
        status.textContent = "Waiting for input";
        if (placeholder) { output.textContent = ""; placeholder = false; }
        field.value = "";
        output.appendChild(field);
        field.focus({ preventScroll: true });
        output.scrollTop = output.scrollHeight;
    }

    function sendInput(text) {
        if (!answer) return;
        const reply = answer;
        answer = null;
        field.remove();
        if (text === null) write("note", "(end of input)\n");
        else write("echo", text + "\n");
        status.textContent = "Running…";
        reply(text);
    }

    field.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); sendInput(field.value); }
        else if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); sendInput(null); }
        else if (e.key === "Escape") { e.preventDefault(); editor.focus(); }
    });
    // Clicking in the console while the program waits focuses the field.
    output.addEventListener("click", () => {
        if (answer && !getSelection().toString()) field.focus();
    });

    clearBtn.addEventListener("click", () => {
        resetOutput();
        placeholder = false;
        if (!current) status.textContent = "";
    });

    // ---- running ----
    let current = null;
    let ticker = 0;

    function setRunning(on) {
        runBtn.disabled = on;
        stopBtn.hidden = !on;
        runBtn.querySelector("span").textContent = on ? "Running…" : "Run";
        clearInterval(ticker);
        if (on) {
            const t0 = performance.now();
            status.textContent = "Running…";
            ticker = setInterval(() => {
                const s = (performance.now() - t0) / 1000;
                if (s > 2 && !answer) status.textContent = `Running for ${s.toFixed(0)} s. Stop it if it's stuck in a loop.`;
            }, 500);
        }
    }

    function run() {
        if (current || runBtn.dataset.ready !== "true") return;
        resetOutput();
        placeholder = false;
        wroteAnything = false;
        setRunning(true);
        current = PieRunner.run(editor.value, {
            stdin: stdin.value,
            onOutput: write,
            onInput: askForInput,
            onDone: (info) => {
                render();
                current = null;
                answer = null;
                const hadFocus = document.activeElement === field;
                field.remove();
                setRunning(false);
                if (info.stopped) status.textContent = "Stopped";
                else if (info.crashed) status.textContent = "Crashed";
                else {
                    status.textContent = `Finished in ${Math.max(1, Math.round(info.ms || 0))} ms`;
                    if (!wroteAnything) write("note", "(no output)\n");
                }
                render();
                if (hadFocus) editor.focus();
            },
        });
    }

    runBtn.addEventListener("click", run);
    stopBtn.addEventListener("click", () => current && current.stop());

    // ---- share ----
    shareBtn.addEventListener("click", async () => {
        const url = PieShare.link(editor.value);
        history.replaceState(null, "", "#code=" + PieShare.encode(editor.value));
        const label = shareBtn.lastChild;
        const old = label.textContent;
        try {
            await navigator.clipboard.writeText(url);
            label.textContent = " Link copied";
        } catch (_) {
            label.textContent = " Link is in the address bar";
        }
        setTimeout(() => { label.textContent = old; }, 2000);
    });

    // Links that only change the hash (e.g. from another tab's history) load too.
    addEventListener("hashchange", () => {
        const h = new URLSearchParams(location.hash.slice(1));
        let code = null, id = "";
        if (h.get("code")) { try { code = PieShare.decode(h.get("code")); } catch (_) { code = null; } }
        else if (h.get("example")) {
            const ex = examples.find((e) => e.id === h.get("example"));
            if (ex) { code = ex.code; id = ex.id; }
        }
        if (code === null || code === editor.value) return;
        settingExample = true;
        editor.setValue(code);
        settingExample = false;
        select.value = id;
    });

    // ---- load the interpreter ----
    // Register the input helper early so it's in charge before the first run.
    PieRunner.enableInput();
    PieRunner.preload().then(() => {
        runBtn.dataset.ready = "true";
        runBtn.disabled = false;
        runBtn.querySelector("span").textContent = "Run";
    }).catch((e) => {
        runBtn.querySelector("span").textContent = "Pie didn't load";
        write("err", "Couldn't load the Pie interpreter: " + (e.message || e) +
            "\nCheck that Pie.js and Pie.wasm sit next to playground.html, then reload.");
    });

    // Don't pop up the on-screen keyboard on phones.
    if (matchMedia("(pointer: fine)").matches) editor.focus();
})();
