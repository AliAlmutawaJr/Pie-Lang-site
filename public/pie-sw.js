/*
 * Service worker that lets a running Pie program wait for keyboard input.
 *
 * WebAssembly can't pause in the middle of a C++ `std::getline`, so the worker
 * running Pie makes a *synchronous* request to `__pie_stdin__` whenever the
 * program needs input. This service worker holds that request open until the
 * page sends the line the user typed, then answers it.
 *
 * It must live at the site root so its scope covers assets/js/pie-worker.js.
 * It doesn't cache anything; every other request goes straight to the network.
 */
"use strict";

const WAIT_MS = 20000;     // answer "retry" before the browser gives up on us
const waiting = new Map(); // run id -> function answering the open request
const queued = new Map();  // run id -> messages that arrived before the request

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
    const msg = event.data || {};
    if (!msg.pieStdin) return;
    const { id } = msg;

    if (msg.cancel) {
        queued.delete(id);
        const answer = waiting.get(id);
        if (answer) answer({ eof: true });
        return;
    }

    const reply = msg.eof ? { eof: true } : { text: String(msg.text) };
    const answer = waiting.get(id);
    if (answer) answer(reply);
    else {
        if (!queued.has(id)) queued.set(id, []);
        queued.get(id).push(reply);
    }
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (!url.pathname.endsWith("/__pie_stdin__")) return;

    const json = (body) => new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

    // The worker checks it can reach us before the program starts.
    if (url.searchParams.has("ping")) {
        event.respondWith(json({ pong: true }));
        return;
    }

    const id = url.searchParams.get("id");
    event.respondWith(new Promise((resolve) => {
        const early = queued.get(id);
        if (early && early.length) {
            resolve(json(early.shift()));
            return;
        }

        const answer = (reply) => {
            clearTimeout(timer);
            if (waiting.get(id) === answer) waiting.delete(id);
            resolve(json(reply));
        };
        const timer = setTimeout(() => answer({ retry: true }), WAIT_MS);
        waiting.set(id, answer);
    }));
});
