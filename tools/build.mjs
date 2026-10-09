#!/usr/bin/env node
// Builds the site's HTML from src/ and docs-src/.
//
//   npm install      (once, for `marked`)
//   npm run build
//
// Inputs
//   src/*.html              page templates
//   src/partials/*.html     {{> name key=value}} includes
//   docs-src/docs.md        the documentation (see docs-src/README.md)
//   docs-src/prelude.pie    the "starter operators" used by `pie run+` blocks
//   docs-src/examples/*.pie playground examples (first line `.: Title`)
//   docs-src/ideas/*.pie    home page snippets (+ .out with their output)
//
// Outputs (site root)
//   index.html playground.html docs.html spec.html assets/js/examples.js

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { marked } from "marked";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const require = createRequire(import.meta.url);
const { highlight, declaredOperators } = require(join(root, "assets/js/pie-highlight.js"));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const playLink = (code) => "playground.html#code=" + b64url(code);
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

const prelude = read("docs-src/prelude.pie").trimEnd();

// ---------------------------------------------------------------- partials
function renderPartials(html) {
    return html.replace(/\{\{>\s*([\w-]+)((?:\s+[\w-]+=(?:"[^"]*"|\S+?))*)\s*\}\}/g, (_, name, argStr) => {
        const args = {};
        for (const m of argStr.matchAll(/([\w-]+)=(?:"([^"]*)"|(\S+))/g)) args[m[1]] = m[2] ?? m[3];
        let part = read(`src/partials/${name}.html`).trimEnd();
        part = part.replace(/\{\{current:(\w+)\}\}/g, (_, page) => (args.current === page ? ' aria-current="page"' : ""));
        part = part.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in args ? esc(args[key]) : m));
        return part;
    });
}

// ---------------------------------------------------------------- docs
const ICON_RUN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>';

function codeBlock(lang, text) {
    const [kind, mode = ""] = (lang || "").split(/\s+/);
    if (kind === "output") {
        return `<div class="output"><div class="output-label">Output</div><pre>${esc(text)}</pre></div>`;
    }
    if (kind !== "pie") {
        return `<figure class="code plain"><pre>${esc(text)}</pre></figure>`;
    }

    const usesPrelude = mode.endsWith("+");
    const runnable = mode.startsWith("run") || mode.startsWith("error");
    const full = usesPrelude ? prelude + "\n\n" + text : text;
    const ops = declaredOperators(full);

    let label = "";
    if (mode.startsWith("error")) label = '<span class="label error">Stops with an error</span>';
    else label = '<span class="label"></span>';
    if (usesPrelude) {
        label = label.replace("</span>", ' <button class="prelude-toggle" type="button" aria-expanded="false">Uses the starter operators</button></span>');
    }

    const buttons =
        `<button class="btn-small copy" type="button">${ICON_COPY}<span>Copy</span></button>` +
        (runnable ? `<a class="btn-small run" href="${esc(playLink(full))}">${ICON_RUN}Run</a>` : "");

    return `<figure class="code"${usesPrelude ? " data-prelude" : ""}>` +
        `<div class="code-bar">${label}${buttons}</div>` +
        (usesPrelude ? `<pre class="prelude" aria-label="Starter operators"><code>${highlight(prelude, ops)}</code></pre>` : "") +
        `<pre class="main"><code>${highlight(text, ops)}</code></pre></figure>`;
}

function buildDocs() {
    const md = read("docs-src/docs.md");
    const tokens = marked.lexer(md);
    const toc = [];
    const used = new Set();
    let html = "";

    const renderOne = (t) => {
        const list = [t];
        list.links = tokens.links;
        return marked.parser(list);
    };

    for (const t of tokens) {
        if (t.type === "heading") {
            const inner = marked.parseInline(t.text);
            if (t.depth === 1) { html += `<h1>${inner}</h1>\n`; continue; }
            let id = slug(t.text);
            while (used.has(id)) id += "-";
            used.add(id);
            if (t.depth === 2) toc.push({ id, text: inner, children: [] });
            else if (t.depth === 3 && toc.length) toc[toc.length - 1].children.push({ id, text: inner });
            html += `<h${t.depth} id="${id}"><a class="anchor" href="#${id}">${inner}</a></h${t.depth}>\n`;
        } else if (t.type === "code") {
            html += codeBlock(t.lang, t.text) + "\n";
        } else if (t.type === "table") {
            html += `<div class="table-wrap">${renderOne(t)}</div>\n`;
        } else {
            html += renderOne(t);
        }
    }

    // check internal links
    for (const m of md.matchAll(/\]\(#([\w-]+)\)/g)) {
        if (!used.has(m[1])) console.warn(`docs.md: broken link #${m[1]}`);
    }

    const tocHtml = "<ol>" + toc.map((s) =>
        `<li class="lvl2"><a href="#${s.id}">${s.text}</a>` +
        (s.children.length ? "<ol>" + s.children.map((c) => `<li class="lvl3"><a href="#${c.id}">${c.text}</a></li>`).join("") + "</ol>" : "") +
        "</li>").join("") + "</ol>";

    return { html, tocHtml };
}

// ---------------------------------------------------------------- examples
function buildExamples() {
    const dir = join(root, "docs-src/examples");
    const list = readdirSync(dir).filter((f) => f.endsWith(".pie")).sort().map((f) => {
        const src = readFileSync(join(dir, f), "utf8");
        const [first, ...rest] = src.split("\n");
        const title = first.replace(/^\.:\s*/, "").trim();
        return { id: f.replace(/^\d+-/, "").replace(/\.pie$/, ""), title, code: rest.join("\n").trimEnd() + "\n" };
    });
    const js = "/* Generated by tools/build.mjs from docs-src/examples. Edit those files instead. */\n" +
        "window.PIE_EXAMPLES = " + JSON.stringify(list, null, 1) + ";\n";
    writeFileSync(join(root, "assets/js/examples.js"), js);
    return list;
}

// ---------------------------------------------------------------- pages
function page(name, extra = (h) => h) {
    let html = read(`src/${name}`);
    html = renderPartials(html);
    html = extra(html);
    writeFileSync(join(root, name), html);
    console.log("built", name);
}

const examples = buildExamples();
console.log(`built assets/js/examples.js (${examples.length} examples)`);

page("index.html", (h) => h
    .replace(/\{\{idea:([\w-]+)\}\}/g, (_, n) => highlight(read(`docs-src/ideas/${n}.pie`).trimEnd()))
    .replace(/\{\{idea-out:([\w-]+)\}\}/g, (_, n) => {
        const f = `docs-src/ideas/${n}.out`;
        return existsSync(join(root, f)) ? esc(read(f).trimEnd()) : "";
    })
    .replace(/\{\{idea-link:([\w-]+)\}\}/g, (_, n) => esc(playLink(read(`docs-src/ideas/${n}.pie`)))));

page("playground.html");
page("spec.html");

const docs = buildDocs();
page("docs.html", (h) => h
    .replace("{{toc}}", () => docs.tocHtml)
    .replace("{{content}}", () => docs.html)
    .replace("{{prelude}}", () => prelude.replace(/<\//g, "<\\/")));
