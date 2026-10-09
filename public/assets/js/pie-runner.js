/*
 * PieRunner: runs Pie code with the WebAssembly build (Pie.js + Pie.wasm).
 *
 *   const run = PieRunner.run(code, {
 *       stdin: "",                // Program input box: answers the first reads, one per line
 *       onOutput(type, text) {},  // type: "out" | "err" | "note" | "echo"; raw text chunks
 *       onInput(answer) {},       // the box ran out and the program wants a line:
 *                                 // call answer("text"), or answer(null) to end input
 *       onDone({ ms, stopped, crashed }) {},
 *       interactive: true,        // false: never ask; input ends after the box
 *   });
 *   run.stop();
 *
 * The .wasm file is compiled once and shared; every run gets a fresh instance
 * inside a Web Worker. Typed input goes through pie-sw.js (see there). Where
 * that can't work, input ends after the box's lines and the output panel says
 * so, and why.
 */
(function () {
    "use strict";

    const script = document.currentScript;
    const base = new URL(script ? script.src : location.href);
    const root = new URL("../../", base); // assets/js/ -> site root
    const GLUE = new URL("Pie.js", root).href;
    const WASM = new URL("Pie.wasm", root).href;
    const WORKER = new URL("pie-worker.js", base).href;
    const SW = new URL("pie-sw.js", root).href;
    const STDIN = new URL("__pie_stdin__", root).href;

    let compiled = null;
    function compile() {
        if (!compiled) {
            compiled = (async () => {
                const res = await fetch(WASM);
                if (!res.ok) throw new Error(`Couldn't download Pie.wasm (HTTP ${res.status})`);
                if (WebAssembly.compileStreaming && (res.headers.get("content-type") || "").includes("wasm")) {
                    return WebAssembly.compileStreaming(res);
                }
                return WebAssembly.compile(await res.arrayBuffer());
            })();
            compiled.catch(() => { compiled = null; });
        }
        return compiled;
    }

    const canUseWorkers = () => typeof Worker !== "undefined" && location.protocol !== "file:";

    // ---- service worker for typed input --------------------------------------
    let swReady = null;
    let swBroken = false; // the worker couldn't reach pie-sw.js once; don't retry
    let reason = "";
    const why = (msg) => {
        reason = msg;
        console.info("[Pie playground] Typing input into the output panel isn't available: " + msg);
        return false;
    };
    const ranOutNote = (onOutput, canAsk) => onOutput("note",
        "\n(Your program wanted more input than the Program input box has." +
        (canAsk || !reason ? "" : ` Typing it into the output panel isn't available here: ${reason || "unknown reason."}`) +
        " Add more lines to the box and run again.)\n");

    // The box's text as lines. A final newline doesn't add an empty answer.
    const toLines = (text) => {
        if (!text) return [];
        const lines = text.replace(/\r\n?/g, "\n").split("\n");
        if (lines[lines.length - 1] === "") lines.pop();
        return lines;
    };

    function enableInput() {
        if (swReady) return swReady;
        const attempt = (async () => {
            if (!("serviceWorker" in navigator)) return why("this browser has no service workers.");
            if (!window.isSecureContext) return why("the page isn't served over https or from localhost.");
            try {
                await navigator.serviceWorker.register(SW, { scope: root.pathname });
                await navigator.serviceWorker.ready;
                if (!navigator.serviceWorker.controller) {
                    // first visit: wait for clients.claim() to take over this page
                    await new Promise((resolve) => {
                        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
                        setTimeout(resolve, 3000);
                    });
                }
                return navigator.serviceWorker.controller ? true
                    : why("the service worker isn't controlling this page (a hard reload skips it; reload normally).");
            } catch (e) {
                return why("registering pie-sw.js failed: " + e.message);
            }
        })();
        // `ready` never settles if registration silently fails, so don't wait forever.
        const timeout = new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000));
        swReady = Promise.race([attempt, timeout]).then((r) =>
            r === "timeout" ? why("the service worker didn't start within 5 seconds.") : r);
        return swReady;
    }

    const swPost = (msg) => {
        const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
        if (sw) sw.postMessage({ pieStdin: true, ...msg });
    };

    function run(code, opts = {}) {
        const onOutput = opts.onOutput || (() => {});
        const onInput = opts.onInput || ((answer) => answer(null));
        const onDone = opts.onDone || (() => {});
        const runId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        let worker = null;
        let finished = false;
        let interactive = false;

        const finish = (info) => {
            if (finished) return;
            finished = true;
            if (worker) worker.terminate();
            if (interactive) swPost({ id: runId, cancel: true });
            onDone(info);
        };

        const handle = {
            stop() {
                if (finished) return;
                onOutput("note", "\nStopped.\n");
                finish({ stopped: true });
            },
        };

        const lines = toLines(opts.stdin);
        const wantsInput = opts.interactive !== false && /__builtin_input_/.test(code);

        (async () => {
            const swOk = wantsInput && canUseWorkers() && !swBroken ? await enableInput() : false;
            if (finished) return;

            if (!canUseWorkers()) {
                if (wantsInput) why("this page was opened without a web server (file://).");
                finish(await runOnPage(code, lines, onOutput, wantsInput));
                return;
            }

            const wasmModule = await compile();
            if (finished) return;
            start(wasmModule, swOk);
        })().catch((e) => {
            onOutput("err", (e.message || String(e)) + "\n");
            finish({ crashed: true });
        });

        function start(wasmModule, withInput) {
            interactive = withInput;
            worker = new Worker(WORKER);
            worker.onmessage = ({ data }) => {
                if (finished) return;
                if (data.type === "out" || data.type === "err") onOutput(data.type, data.text);
                else if (data.type === "echo") onOutput("echo", data.text);
                else if (data.type === "ran-out") ranOutNote(onOutput, false);
                else if (data.type === "input") {
                    let answered = false;
                    onInput((text) => {
                        if (answered || finished) return;
                        answered = true;
                        swPost(text === null || text === undefined ? { id: runId, eof: true } : { id: runId, text });
                    });
                } else if (data.type === "no-input") {
                    // Nothing has run yet, so start again without typed input.
                    swBroken = true;
                    why("requests from the worker don't reach pie-sw.js.");
                    worker.terminate();
                    worker = null;
                    start(wasmModule, false);
                } else if (data.type === "limit") {
                    onOutput("note", "\nStopped: the program printed more than 2 MB.\n");
                    finish({ stopped: true });
                } else if (data.type === "crash") {
                    onOutput("err", data.text + "\n");
                    finish({ crashed: true });
                } else if (data.type === "done") finish({ ms: data.ms });
            };
            worker.onerror = (e) => {
                e.preventDefault();
                onOutput("err", "The interpreter crashed: " + (e.message || "unknown error") + "\n");
                finish({ crashed: true });
            };
            worker.postMessage({
                code, lines, wasmModule, glueUrl: GLUE,
                stdinUrl: withInput ? STDIN : null,
                runId,
            });
        }

        return handle;
    }

    // ---- fallback: one shared instance on the page (no workers, e.g. file://)
    let pageModule = null;
    let sink = null;
    let pageLines = [];
    let pageWantsInput = false;
    let pending = [];
    let lineDelivered = false;
    const decoders = { out: new TextDecoder(), err: new TextDecoder() };
    const partial = { out: "", err: "" };

    function pagePut(type, byte) {
        partial[type] += decoders[type].decode(new Uint8Array([byte]), { stream: true });
        if (byte === 10) pageFlush(type);
    }
    function pageFlush(type) {
        const text = partial[type].replace(/\0/g, "");
        partial[type] = "";
        if (text && sink) sink(type, text);
    }

    function loadOnPage() {
        if (pageModule) return pageModule;
        pageModule = new Promise((resolve, reject) => {
            window.Module = {
                noInitialRun: true,
                stdout: (b) => pagePut("out", b),
                stderr: (b) => pagePut("err", b),
                print: (t) => sink && sink("out", String(t).replace(/\0/g, "") + "\n"),
                printErr: (t) => sink && sink("err", String(t).replace(/\0/g, "") + "\n"),
                // Same rule as in pie-worker.js: return null once after a whole
                // line, or Emscripten asks for the next line straight away.
                stdin: () => {
                    if (lineDelivered) { lineDelivered = false; return null; }
                    if (!pending.length) {
                        pageFlush("out");
                        pageFlush("err");
                        if (!pageLines.length) {
                            if (pageWantsInput && sink) ranOutNote(sink, false);
                            pageWantsInput = false; // say it once
                            return null;
                        }
                        const line = pageLines.shift();
                        sink && sink("echo", line + "\n");
                        pending = Array.from(new TextEncoder().encode(line + "\n"));
                    }
                    const byte = pending.shift();
                    if (!pending.length) lineDelivered = true;
                    return byte;
                },
                locateFile: (p) => new URL(p, root).href,
                onRuntimeInitialized: () => resolve(window.Module),
            };
            const s = document.createElement("script");
            s.src = GLUE;
            s.onerror = () => reject(new Error("Couldn't load Pie.js"));
            document.head.appendChild(s);
        });
        return pageModule;
    }

    async function runOnPage(code, lines, onOutput, wantsInput) {
        try {
            const M = await loadOnPage();
            sink = onOutput;
            pageLines = lines.slice();
            pageWantsInput = wantsInput;
            pending = [];
            lineDelivered = false;
            const t0 = performance.now();
            try {
                if (typeof M._execute === "function") M.ccall("execute", null, ["string"], [code]);
                else M.callMain(["-c", code]);
            } catch (e) {
                onOutput("err", String((e && e.message) || e)
                    .replace(/(?:\x1b\[[0-9;]*m)?[^\n]*?\.(?:hxx|cxx|cc|cpp|h):\d+:\d+:\s*/g, "") + "\n");
            }
            pageFlush("out");
            pageFlush("err");
            sink = null;
            return { ms: performance.now() - t0 };
        } catch (e) {
            onOutput("err", (e.message || String(e)) + "\n");
            return { crashed: true };
        }
    }

    window.PieRunner = {
        run,
        preload: () => (canUseWorkers() ? compile() : loadOnPage()),
        enableInput,
    };
})();
