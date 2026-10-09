/*
 * A small code editor for Pie: a transparent <textarea> on top of a
 * highlighted <pre>, with a line-number gutter.
 *
 *   const ed = new PieEditor(element, { value, onChange, onRun });
 *   ed.value; ed.setValue(text); ed.focus();
 *
 * Keys:
 *   Tab / Shift+Tab     indent / outdent (inserts a real \t)
 *   Enter               keeps indentation, indents after { ( and splits {}
 *   Ctrl/Cmd + /        toggle `.:` line comments
 *   Alt/Option + ↑ ↓    move the current line(s) up or down
 *   Shift+Alt/Option + ↑ ↓   copy the current line(s) up or down
 *   Ctrl/Cmd + Enter    run
 *   Esc                 the next Tab leaves the editor (keyboard escape hatch)
 *   ( { " `             auto-closed; typing the closer steps over it
 */
(function () {
    "use strict";

    const PAIRS = { "(": ")", "{": "}", '"': '"', "`": "`" };
    const CLOSERS = new Set([")", "}", '"', "`"]);

    class PieEditor {
        constructor(host, opts = {}) {
            this.opts = opts;
            this.host = host;
            this.escaped = false;
            host.classList.add("pie-editor");
            host.innerHTML = `
                <div class="pe-gutter" aria-hidden="true"></div>
                <div class="pe-scroll">
                    <pre class="pe-highlight" aria-hidden="true"><code></code></pre>
                    <textarea class="pe-input" spellcheck="false" autocapitalize="off"
                        autocomplete="off" autocorrect="off" wrap="off"
                        aria-label="${opts.label || "Pie code editor"}"></textarea>
                </div>
                <div class="pe-hint" role="status" aria-live="polite"></div>`;
            this.gutter = host.querySelector(".pe-gutter");
            this.scroll = host.querySelector(".pe-scroll");
            this.code = host.querySelector(".pe-highlight code");
            this.ta = host.querySelector(".pe-input");
            this.hint = host.querySelector(".pe-hint");

            this.ta.value = opts.value || "";
            this.ta.addEventListener("input", () => this.refresh(true));
            this.ta.addEventListener("keydown", (e) => this.onKey(e));
            this.ta.addEventListener("blur", () => this.setEscaped(false));
            this.ta.addEventListener("scroll", () => this.syncScroll());
            this.refresh(false);
        }

        get value() { return this.ta.value; }

        setValue(text) {
            this.ta.value = text;
            this.ta.setSelectionRange(0, 0);
            this.ta.scrollTop = 0;
            this.ta.scrollLeft = 0;
            this.refresh(true);
        }

        focus() { this.ta.focus(); }

        refresh(changed) {
            const text = this.ta.value;
            // a trailing newline needs a placeholder so the pre keeps its height
            this.code.innerHTML = window.PieHighlight.highlight(text) + "\n";
            const lines = text.split("\n").length;
            if (lines !== this.lineCount) {
                this.lineCount = lines;
                let g = "";
                for (let i = 1; i <= lines; i++) g += i + "\n";
                this.gutter.textContent = g;
            }
            this.syncScroll();
            if (changed && this.opts.onChange) this.opts.onChange(text);
        }

        syncScroll() {
            const pre = this.code.parentElement;
            pre.style.transform = `translate(${-this.ta.scrollLeft}px, ${-this.ta.scrollTop}px)`;
            this.gutter.style.transform = `translateY(${-this.ta.scrollTop}px)`;
        }

        setEscaped(on) {
            this.escaped = on;
            this.hint.textContent = on ? "Tab now moves focus out of the editor." : "";
            this.host.classList.toggle("pe-escaped", on);
        }

        // Insert text through the browser's editing pipeline so undo works.
        insert(text, selStart, selEnd) {
            const ta = this.ta;
            if (selStart !== undefined) ta.setSelectionRange(selStart, selEnd);
            let ok = false;
            try { ok = document.execCommand("insertText", false, text); } catch (_) { ok = false; }
            if (!ok) {
                const s = ta.selectionStart;
                ta.setRangeText(text, s, ta.selectionEnd, "end");
                this.refresh(true);
            }
        }

        lineBounds(pos) {
            const v = this.ta.value;
            const start = v.lastIndexOf("\n", pos - 1) + 1;
            let end = v.indexOf("\n", pos);
            if (end < 0) end = v.length;
            return [start, end];
        }

        // Replace whole lines covering the selection with transform(lines).
        editLines(transform) {
            const ta = this.ta;
            const v = ta.value;
            const s = ta.selectionStart, e = ta.selectionEnd;
            const [ls] = this.lineBounds(s);
            // a selection ending at column 0 doesn't include that line
            const endPos = e > s && v[e - 1] === "\n" ? e - 1 : e;
            const [, le] = this.lineBounds(endPos);
            const lines = v.slice(ls, le).split("\n");
            const res = transform(lines);
            const text = res.lines.join("\n");
            this.insert(text, ls, le);
            if (s === e) {
                const caret = Math.max(ls, s + res.firstDelta);
                ta.setSelectionRange(caret, caret);
            } else {
                ta.setSelectionRange(ls, ls + text.length);
            }
        }

        // The lines covered by the selection, as [start, end) offsets.
        selectedLines() {
            const ta = this.ta, v = ta.value;
            const s = ta.selectionStart, e = ta.selectionEnd;
            const [ls] = this.lineBounds(s);
            const endPos = e > s && v[e - 1] === "\n" ? e - 1 : e;
            const [, le] = this.lineBounds(endPos);
            return [ls, le];
        }

        // Alt/Option + Up/Down, like VS Code.
        moveLines(dir) {
            const ta = this.ta, v = ta.value;
            const s = ta.selectionStart, e = ta.selectionEnd, back = ta.selectionDirection;
            const [ls, le] = this.selectedLines();
            const block = v.slice(ls, le);
            if (dir < 0) {
                if (ls === 0) return;
                const [ps] = this.lineBounds(ls - 1);
                const prev = v.slice(ps, ls - 1);
                this.insert(block + "\n" + prev, ps, le);
                const shift = prev.length + 1;
                ta.setSelectionRange(s - shift, e - shift, back);
            } else {
                if (le >= v.length) return;
                const [, ne] = this.lineBounds(le + 1);
                const next = v.slice(le + 1, ne);
                this.insert(next + "\n" + block, ls, ne);
                const shift = next.length + 1;
                ta.setSelectionRange(s + shift, e + shift, back);
            }
        }

        // Shift + Alt/Option + Up/Down: duplicate the lines, selecting the copy.
        copyLines(dir) {
            const ta = this.ta, v = ta.value;
            const s = ta.selectionStart, e = ta.selectionEnd, back = ta.selectionDirection;
            const [ls, le] = this.selectedLines();
            const block = v.slice(ls, le);
            if (dir < 0) {
                this.insert(block + "\n", ls, ls);
                ta.setSelectionRange(s, e, back);
            } else {
                this.insert("\n" + block, le, le);
                const shift = block.length + 1;
                ta.setSelectionRange(s + shift, e + shift, back);
            }
        }

        onKey(e) {
            const ta = this.ta;
            const mod = e.ctrlKey || e.metaKey;

            if (e.altKey && !mod && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault();
                const dir = e.key === "ArrowUp" ? -1 : 1;
                if (e.shiftKey) this.copyLines(dir);
                else this.moveLines(dir);
                return;
            }

            if (e.key === "Escape") { this.setEscaped(true); return; }

            if (e.key === "Tab") {
                if (this.escaped) { this.setEscaped(false); return; } // let focus move
                e.preventDefault();
                const s = ta.selectionStart, end = ta.selectionEnd;
                const multi = ta.value.slice(s, end).includes("\n");
                if (e.shiftKey) {
                    this.editLines((lines) => {
                        let firstDelta = 0;
                        const out = lines.map((l, idx) => {
                            const m = l.match(/^(\t| {1,4})/);
                            if (!m) return l;
                            if (idx === 0) firstDelta = -m[1].length;
                            return l.slice(m[1].length);
                        });
                        return { lines: out, firstDelta };
                    });
                } else if (multi) {
                    this.editLines((lines) => ({
                        lines: lines.map((l) => (l.length ? "\t" + l : l)),
                        firstDelta: 1,
                    }));
                } else {
                    this.insert("\t");
                }
                return;
            }

            if (mod && e.key === "Enter") {
                e.preventDefault();
                if (this.opts.onRun) this.opts.onRun();
                return;
            }

            if (mod && (e.key === "/" || e.code === "Slash")) {
                e.preventDefault();
                this.editLines((lines) => {
                    const nonEmpty = lines.filter((l) => l.trim());
                    const allCommented = nonEmpty.length && nonEmpty.every((l) => /^\s*\.:/.test(l));
                    let firstDelta = 0;
                    const out = lines.map((l, idx) => {
                        if (!l.trim()) return l;
                        if (allCommented) {
                            const r = l.replace(/^(\s*)\.: ?/, "$1");
                            if (idx === 0) firstDelta = r.length - l.length;
                            return r;
                        }
                        if (idx === 0) firstDelta = 3;
                        return l.replace(/^(\s*)/, "$1.: ");
                    });
                    return { lines: out, firstDelta };
                });
                return;
            }

            if (e.key === "Enter" && !e.shiftKey && !e.altKey && !mod) {
                e.preventDefault();
                const v = ta.value;
                const s = ta.selectionStart;
                const [ls] = this.lineBounds(s);
                const indent = v.slice(ls, s).match(/^[ \t]*/)[0];
                const before = v[s - 1], after = v[ta.selectionEnd];
                const opens = before === "{" || before === "(";
                if (opens && ta.selectionStart === ta.selectionEnd && after === PAIRS[before]) {
                    this.insert("\n" + indent + "\t" + "\n" + indent);
                    const caret = s + 1 + indent.length + 1;
                    ta.setSelectionRange(caret, caret);
                } else {
                    this.insert("\n" + indent + (opens ? "\t" : ""));
                }
                return;
            }

            if (e.key === "Backspace" && !mod && ta.selectionStart === ta.selectionEnd) {
                const v = ta.value, s = ta.selectionStart;
                if (s > 0 && PAIRS[v[s - 1]] && v[s] === PAIRS[v[s - 1]]) {
                    e.preventDefault();
                    this.insert("", s - 1, s + 1);
                    return;
                }
            }

            if (!mod && !e.altKey && e.key.length === 1) {
                const v = ta.value, s = ta.selectionStart, end = ta.selectionEnd;
                // step over an auto-inserted closer
                if (CLOSERS.has(e.key) && s === end && v[s] === e.key) {
                    e.preventDefault();
                    ta.setSelectionRange(s + 1, s + 1);
                    return;
                }
                if (PAIRS[e.key]) {
                    const close = PAIRS[e.key];
                    if (s !== end) { // wrap the selection
                        e.preventDefault();
                        const sel = v.slice(s, end);
                        this.insert(e.key + sel + close);
                        ta.setSelectionRange(s + 1, s + 1 + sel.length);
                        return;
                    }
                    const next = v[s] || "";
                    const prev = v[s - 1] || "";
                    const quote = e.key === '"' || e.key === "`";
                    const okNext = next === "" || /[\s)\]};,]/.test(next);
                    const okPrev = !quote || prev === "" || /[\s(\[{,=:]/.test(prev);
                    if (okNext && okPrev) {
                        e.preventDefault();
                        this.insert(e.key + close);
                        ta.setSelectionRange(s + 1, s + 1);
                        return;
                    }
                }
            }
        }
    }

    window.PieEditor = PieEditor;
})();
