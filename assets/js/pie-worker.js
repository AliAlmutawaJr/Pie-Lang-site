/*
 * Runs one Pie program in its own WebAssembly instance.
 * A fresh worker is used for every run, so programs never see each other's
 * state, and the page can stop a runaway loop by terminating the worker.
 *
 * Messages in:
 *   { code, lines, wasmModule, glueUrl, stdinUrl?, runId? }
 *   `lines` (from the Program input box) answer the first reads. After that,
 *   with stdinUrl, reading pauses the program until the page answers (see
 *   pie-sw.js); without it, input ends.
 *
 * Messages out:
 *   { type: "out" | "err", text }   raw text, not necessarily whole lines
 *   { type: "echo", text }          a line taken from `lines`, to show in the output
 *   { type: "input" }               the program is waiting for a typed line
 *   { type: "ran-out" }             the program read past the end of `lines`
 *                                   and can't ask (no stdinUrl)
 *   { type: "no-input" }            requests to stdinUrl don't reach pie-sw.js,
 *                                   so the program wasn't started
 *   { type: "done", ms } | { type: "crash", text } | { type: "limit" }
 */
"use strict";

// Pie.js is built with -sENVIRONMENT=web; it only checks that `window` exists.
self.window = self;

const LIMIT = 2 * 1024 * 1024; // stop runaway output at ~2 MB

// ---- output: bytes from stdout/stderr, decoded and batched ----------------
const streams = {
    out: { decoder: new TextDecoder(), text: "" },
    err: { decoder: new TextDecoder(), text: "" },
};
let order = [];   // which streams have pending text, in order
let bytes = 0;
let lastFlush = 0;
let flushTimer = 0;

function put(type, byte) {
    const s = streams[type];
    s.text += s.decoder.decode(new Uint8Array([byte]), { stream: true });
    if (order[order.length - 1] !== type) order.push(type);
    if (++bytes > LIMIT) {
        flush();
        postMessage({ type: "limit" });
        close();
        return;
    }
    if (byte === 10) schedule(); // newline
}

function putText(type, text) {
    streams[type].text += String(text).replace(/\0/g, "");
    if (order[order.length - 1] !== type) order.push(type);
    schedule();
}

function schedule() {
    // A busy program never yields to timers, so flush on a clock as well.
    if (performance.now() - lastFlush > 50) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, 30);
}

function flush() {
    clearTimeout(flushTimer);
    flushTimer = 0;
    lastFlush = performance.now();
    // Interleave in the order the streams were written to.
    for (const type of order) {
        const s = streams[type];
        const text = s.text.replace(/\0/g, "");
        s.text = "";
        if (text) postMessage({ type, text });
    }
    order = [];
}

// ---- input ------------------------------------------------------------------
let inputBytes = [];
let inputEnded = false;
let lineDelivered = false;
let request = 0;

// The next line for the program: from the box first, then typed by the user.
// Returns the line, or null when input has ended.
function nextLine(lines, stdinUrl, runId) {
    flush(); // show any prompt printed without a newline
    if (lines.length) {
        const line = lines.shift();
        postMessage({ type: "echo", text: line + "\n" });
        return line;
    }
    if (!stdinUrl) {
        postMessage({ type: "ran-out" });
        return null;
    }
    postMessage({ type: "input" });
    for (;;) {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `${stdinUrl}?id=${encodeURIComponent(runId)}&n=${++request}`, false);
        try { xhr.send(); } catch (_) { return null; }
        let reply;
        try { reply = JSON.parse(xhr.responseText); } catch (_) { reply = { eof: true }; }
        if (reply.retry) continue;
        if (reply.eof) return null;
        return reply.text;
    }
}

// Is pie-sw.js answering requests from this worker? A hard reload, DevTools'
// "Bypass for network" or some browsers send them to the server instead.
function serviceWorkerAnswers(stdinUrl) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `${stdinUrl}?ping=${Date.now()}`, false);
        xhr.send();
        return JSON.parse(xhr.responseText).pong === true;
    } catch (_) {
        return false;
    }
}

// Emscripten's C++ exception text, minus the interpreter's own source paths.
function exceptionText(e) {
    let text = (e && (e.message || e.toString())) || String(e);
    if (Array.isArray(e) && e.length >= 2) text = e[0] + ": " + e[1];
    return text
        .replace(/^(?:pie::except::\w+|std::\w+(?:::\w+)*):\s*/, "")
        .replace(/(?:\x1b\[[0-9;]*m)?[^\n]*?\.(?:hxx|cxx|cc|cpp|h):\d+:\d+:\s*/g, "");
}

self.onmessage = (event) => {
    const { code, wasmModule, glueUrl, stdinUrl, runId } = event.data;
    const lines = (event.data.lines || []).slice();
    const started = performance.now();

    if (stdinUrl && !serviceWorkerAnswers(stdinUrl)) {
        postMessage({ type: "no-input" });
        return;
    }

    self.Module = {
        noInitialRun: true,
        // Byte-level streams, so prompts without a newline show up right away.
        stdout: (b) => put("out", b),
        stderr: (b) => put("err", b),
        // Emscripten's own messages still come through print/printErr.
        print: (t) => putText("out", t + "\n"),
        printErr: (t) => putText("err", t + "\n"),
        // Emscripten keeps calling this until it returns null, so after handing
        // over a whole line we return null once to end that read; asking for the
        // next line waits until the program actually reads again.
        stdin: () => {
            if (lineDelivered) { lineDelivered = false; return null; }
            if (!inputBytes.length && !inputEnded) {
                const line = nextLine(lines, stdinUrl, runId);
                if (line === null) inputEnded = true;
                else inputBytes = Array.from(new TextEncoder().encode(line + "\n"));
            }
            if (!inputBytes.length) return null;
            const byte = inputBytes.shift();
            if (!inputBytes.length) lineDelivered = true;
            return byte;
        },
        instantiateWasm(imports, receive) {
            WebAssembly.instantiate(wasmModule, imports).then((inst) => receive(inst, wasmModule));
            return {};
        },
        onAbort: (what) => {
            flush();
            postMessage({ type: "crash", text: "The interpreter stopped: " + what });
        },
        onRuntimeInitialized() {
            try {
                if (typeof Module._execute === "function") {
                    Module.ccall("execute", null, ["string"], [code]);
                } else {
                    Module.callMain(["-c", code]);
                }
            } catch (e) {
                if (!(e && e.name === "ExitStatus")) putText("err", exceptionText(e) + "\n");
            }
            // flush C stdio buffers, then ours
            try { Module._fflush && Module._fflush(0); } catch (_) { /* not exported */ }
            flush();
            postMessage({ type: "done", ms: performance.now() - started });
        },
    };

    try {
        importScripts(glueUrl);
    } catch (e) {
        postMessage({ type: "crash", text: "Couldn't load the interpreter: " + e });
    }
};
