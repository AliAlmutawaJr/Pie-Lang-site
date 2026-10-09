#!/usr/bin/env node
// Runs every runnable example in docs-src/docs.md through a native Pie binary
// and compares it with the ```output block that follows it.
//
//   node tools/check-examples.mjs path/to/Pie
//
// Fence info strings understood (see docs-src/README.md):
//   pie          shown only, never run
//   pie run      run as-is
//   pie run+     run with docs-src/prelude.pie prepended
//   pie error    must fail (stand-alone)
//   pie error+   must fail (with the prelude)
//   output       expected stdout of the previous run block

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pie = process.argv[2];
if (!pie) {
    console.error("usage: node tools/check-examples.mjs path/to/Pie [filter]");
    process.exit(2);
}
const filter = process.argv[3] ?? "";

const md = readFileSync(join(root, "docs-src/docs.md"), "utf8");
const prelude = readFileSync(join(root, "docs-src/prelude.pie"), "utf8");
const dir = mkdtempSync(join(tmpdir(), "pie-docs-"));

const fence = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;
const blocks = [];
for (const m of md.matchAll(fence)) {
    const line = md.slice(0, m.index).split("\n").length;
    blocks.push({ info: m[1].trim(), body: m[2], line });
}

const clean = (s) =>
    s.replace(/\0/g, "")
     .replace(/\x1b\[[0-9;]*m/g, "")
     .split("\n").map((l) => l.trimEnd()).join("\n")
     .trim();

let ran = 0, failed = 0;
for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const [lang, mode = ""] = b.info.split(/\s+/);
    if (lang !== "pie" || !mode) continue;
    if (filter && !b.body.includes(filter)) continue;

    const withPrelude = mode.endsWith("+");
    const expectError = mode.startsWith("error");
    const src = (withPrelude ? prelude + "\n" : "") + b.body;
    const file = join(dir, `ex${i}.pie`);
    writeFileSync(file, src);

    const r = spawnSync(pie, [file], { encoding: "utf8", timeout: 10000 });
    const out = clean(r.stdout ?? "");
    const err = clean(r.stderr ?? "");
    ran++;

    const fail = (why) => {
        failed++;
        console.log(`\n✗ docs.md:${b.line} (${b.info}) ${why}`);
        console.log(b.body.split("\n").slice(0, 6).map((l) => "    " + l).join("\n"));
        if (out) console.log("  stdout:\n" + out.split("\n").map((l) => "    " + l).join("\n"));
        if (err) console.log("  stderr:\n" + err.split("\n").map((l) => "    " + l).join("\n"));
    };

    if (expectError) {
        if (r.status === 0 && !err) fail("expected an error, but it ran fine");
        continue;
    }
    if (r.status !== 0 || err) { fail("exited with an error"); continue; }

    const next = blocks[i + 1];
    if (next && next.info === "output") {
        const want = clean(next.body);
        if (want !== out) fail(`output differs\n  expected:\n${want.split("\n").map((l) => "    " + l).join("\n")}`);
    }
}

// Playground examples must run without errors (fed their .in file, if any);
// home page snippets must match their .out files.
import { readdirSync, existsSync } from "node:fs";
for (const sub of ["examples", "ideas"]) {
    const d = join(root, "docs-src", sub);
    for (const f of readdirSync(d).filter((f) => f.endsWith(".pie")).sort()) {
        if (filter && !f.includes(filter)) continue;
        const inFile = join(d, f.replace(/\.pie$/, ".in"));
        const input = existsSync(inFile) ? readFileSync(inFile, "utf8") : "";
        const r = spawnSync(pie, [join(d, f)], { encoding: "utf8", timeout: 10000, input });
        const out = clean(r.stdout ?? ""), err = clean(r.stderr ?? "");
        ran++;
        const outFile = join(d, f.replace(/\.pie$/, ".out"));
        let why = "";
        if (r.status !== 0 || err) why = "exited with an error";
        else if (existsSync(outFile) && clean(readFileSync(outFile, "utf8")) !== out) why = "output differs";
        if (why) {
            failed++;
            console.log(`\n✗ ${sub}/${f} ${why}`);
            if (out) console.log("  stdout:\n" + out.split("\n").map((l) => "    " + l).join("\n"));
            if (err) console.log("  stderr:\n" + err.split("\n").map((l) => "    " + l).join("\n"));
        }
    }
}

console.log(`\n${ran - failed}/${ran} examples passed`);
process.exit(failed ? 1 : 0);
