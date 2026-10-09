# pielang.org

The website for the Pie programming language: a home page, the docs, and a
playground that runs Pie in the browser through WebAssembly.

It's a static site. Everything at the top level is ready to serve as is (GitHub
Pages works; `CNAME` points at pielang.org).

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `docs.html`, `playground.html`, `spec.html` | Built pages. Don't edit them by hand. |
| `src/` | Page templates and shared partials (nav, footer, head) |
| `docs-src/docs.md` | The documentation |
| `docs-src/prelude.pie` | The "starter operators" some doc examples use |
| `docs-src/examples/` | Playground examples (first line `.: Title`) |
| `docs-src/ideas/` | The four snippets on the home page, with expected output |
| `assets/js/pie-highlight.js` | Syntax highlighter (browser and Node) |
| `assets/js/pie-editor.js` | The playground's code editor |
| `assets/js/pie-runner.js`, `pie-worker.js` | Run Pie with `Pie.js` + `Pie.wasm` |
| `pie-sw.js` | Service worker that lets a running program wait for typed input |
| `Pie.js`, `Pie.wasm` | The Emscripten build of Pie |

## Building

```sh
npm install
npm run build
```

This regenerates the four pages and `assets/js/examples.js`.

## Checking the examples

Every runnable example in the docs, the playground and the home page can be run
through a native Pie binary and compared with its expected output:

```sh
npm run check -- path/to/Pie
```

Run it after changing the language to see which docs need updating.

## Updating the interpreter

Replace `Pie.js` and `Pie.wasm` with a new `emcc` build. The playground calls
the exported `execute(const char*)` function when it exists, and otherwise
calls `main` with `-c <code>`. Each run gets a fresh WebAssembly instance in a
Web Worker, so a program can't leak state into the next run and an infinite
loop can be stopped.

When a program reads input, the worker makes a synchronous request to
`__pie_stdin__`, which `pie-sw.js` holds open until you press Enter in the
output panel. That's how a WebAssembly program can pause mid-`getline`
without special build flags. `pie-sw.js` has to stay at the site root.
Where that can't work (no service workers, a hard reload, opening the files
from disk), programs that read input run on the page and ask with `prompt()`,
and the output panel says why.
