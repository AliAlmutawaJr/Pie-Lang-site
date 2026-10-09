/*
 * Pie syntax highlighter.
 *
 * Follows the same lexical rules as the Pie lexer (and pie.tmLanguage.json):
 *   - names are runs of letters, digits and symbol characters, so `x=1` or
 *     `n-1` are single names, exactly like in Pie itself
 *   - `.:` line comments, `.:: ... ::.` block comments
 *   - "strings" with {interpolation} and `syntax literals`
 *   - operators declared with prefix/infix/suffix/exfix/mixfix anywhere in the
 *     source are highlighted as operators wherever they're used
 *
 * Works in the browser (window.PieHighlight) and in Node (module.exports).
 */
(function (root) {
    "use strict";

    const KEYWORDS = new Set([
        "class", "union", "match", "loop", "break", "continue",
        "import", "space", "use", "self",
    ]);
    const FIX = new Set(["prefix", "infix", "suffix", "exfix", "mixfix"]);
    const CONSTANTS = new Set(["true", "false"]);
    const TYPES = new Set(["Int", "Double", "Bool", "String", "Any", "Type", "Syntax"]);

    // Characters that may appear in a Pie name (plus `=`, which joins names
    // such as `==` and `<=`; a lone `=` or `=>` is punctuation).
    const NAME = /[A-Za-z0-9_'!@#$%^&|*+~\-\\/<>\[\]?=]/;
    const SYMBOLIC = /^[!@#$%^&|*+~\-\\/<>\[\]?=]+$/;

    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const span = (cls, text) => `<span class="tok-${cls}">${esc(text)}</span>`;

    // Collect the names of every operator declared in the source.
    function declaredOperators(src) {
        const ops = new Set();
        const re = /(?:^|[\s;{(])(prefix|infix|suffix|exfix|mixfix)\b\s*(\([^)]*\))?\s*([^\n;]*?)\s(?:=|:=)\s/g;
        for (const m of src.matchAll(re)) {
            for (const part of m[3].split(/[\s:]+/)) {
                if (part && part !== "=" ) ops.add(part);
            }
            // operators used as precedence levels: infix(plus +)
            if (m[2]) for (const p of m[2].slice(1, -1).split(/\s+/)) {
                if (p && p !== "+" && p !== "-" && !/^(LOW|HIGH)$/.test(p)) ops.add(p);
            }
        }
        return ops;
    }

    // Find the index of the `}` closing an interpolation that starts at i
    // (i points just after the `{`). Skips nested braces and strings.
    function interpolationEnd(src, i) {
        let depth = 0;
        while (i < src.length) {
            const c = src[i];
            if (c === "\\") { i += 2; continue; }
            if (c === '"') { i = stringEnd(src, i + 1); continue; }
            if (c === "{") depth++;
            else if (c === "}") { if (depth === 0) return i; depth--; }
            else if (c === "\n" && depth === 0) return -1;
            i++;
        }
        return -1;
    }

    // Index just past the closing quote of a string whose body starts at i.
    function stringEnd(src, i) {
        while (i < src.length) {
            const c = src[i];
            if (c === "\\") { i += 2; continue; }
            if (c === '"') return i + 1;
            if (c === "{") {
                const end = interpolationEnd(src, i + 1);
                if (end < 0) { i++; continue; }
                i = end + 1;
                continue;
            }
            i++;
        }
        return src.length;
    }

    function highlight(src, ops) {
        if (!ops) ops = declaredOperators(src);
        let out = "";
        let i = 0;
        let prevSignificant = ""; // last non-space token text, for member detection

        const n = src.length;
        while (i < n) {
            const c = src[i];

            // whitespace
            if (c === " " || c === "\t" || c === "\n" || c === "\r") {
                let j = i;
                while (j < n && /[ \t\n\r]/.test(src[j])) j++;
                out += esc(src.slice(i, j));
                i = j;
                continue;
            }

            // comments
            if (c === "." && src[i + 1] === ":") {
                if (src[i + 2] === ":") {
                    const end = src.indexOf("::.", i + 3);
                    const j = end < 0 ? n : end + 3;
                    out += span("comment", src.slice(i, j));
                    i = j;
                } else {
                    let j = src.indexOf("\n", i);
                    if (j < 0) j = n;
                    out += span("comment", src.slice(i, j));
                    i = j;
                }
                continue;
            }

            // strings with interpolation
            if (c === '"') {
                const end = stringEnd(src, i + 1);
                out += renderString(src.slice(i, end), ops);
                prevSignificant = '"';
                i = end;
                continue;
            }

            // syntax literal / syntax parameter
            if (c === "`") {
                let j = src.indexOf("`", i + 1);
                j = j < 0 ? n : j + 1;
                const inner = src.slice(i + 1, j - 1);
                const closed = src[j - 1] === "`" && j - 1 > i;
                out += `<span class="tok-syntax"><span class="tok-tick">\`</span>${highlight(inner, ops)}` +
                       (closed ? `<span class="tok-tick">\`</span>` : "") + `</span>`;
                prevSignificant = "`";
                i = j;
                continue;
            }

            // punctuation that is never part of a name
            const three = src.slice(i, i + 3);
            const two = src.slice(i, i + 2);
            if (three === "...") { out += span("spread", three); i += 3; prevSignificant = three; continue; }
            if (two === ":=" || two === "::" || two === "..") {
                out += span("punct", two); i += 2; prevSignificant = two; continue;
            }
            if ("(){},;:.".includes(c)) {
                out += span(c === "." ? "punct" : "punct", c);
                prevSignificant = c;
                i++;
                continue;
            }

            // names (and numbers, which are names made only of digits)
            if (NAME.test(c)) {
                let j = i;
                while (j < n && NAME.test(src[j])) j++;
                let word = src.slice(i, j);

                // doubles: 3.14
                if (/^\d+$/.test(word) && src[j] === "." && /\d/.test(src[j + 1] || "")) {
                    let k = j + 1;
                    while (k < n && /\d/.test(src[k])) k++;
                    word = src.slice(i, k);
                    j = k;
                }

                out += classifyWord(word, src, j, prevSignificant, ops);
                prevSignificant = word;
                i = j;
                continue;
            }

            // anything else (unicode, stray characters)
            out += esc(c);
            i++;
        }
        return out;
    }

    function classifyWord(word, src, after, prev, ops) {
        if (word === "=" || word === "=>") return span("punct", word);
        if (/^\d+(\.\d+)?$/.test(word)) return span("number", word);
        if (FIX.has(word)) return span("fix", word);
        if (KEYWORDS.has(word)) return span("keyword", word);
        if (CONSTANTS.has(word)) return span("constant", word);
        if (word.startsWith("__builtin_")) return span("builtin", word);
        if (prev === "." || prev === "..") return span("member", word);
        if (ops.has(word) || SYMBOLIC.test(word)) return span("op", word);
        if (TYPES.has(word)) return span("type", word);

        let k = after;
        while (k < src.length && (src[k] === " " || src[k] === "\t")) k++;
        if (src[k] === "(") return span("fn", word);
        if (/^[A-Z]/.test(word)) return span("type", word);
        return span("name", word);
    }

    function renderString(text, ops) {
        let out = '<span class="tok-string">';
        let i = 0;
        let buf = "";
        const flush = () => { if (buf) { out += esc(buf); buf = ""; } };
        while (i < text.length) {
            const c = text[i];
            if (c === "\\" && i + 1 < text.length) {
                flush();
                out += span("escape", text.slice(i, i + 2));
                i += 2;
                continue;
            }
            if (c === "{" && i > 0) {
                const end = interpolationEnd(text, i + 1);
                if (end > 0) {
                    flush();
                    out += `<span class="tok-interp"><span class="tok-brace">{</span>` +
                           highlight(text.slice(i + 1, end), ops) +
                           `<span class="tok-brace">}</span></span>`;
                    i = end + 1;
                    continue;
                }
            }
            buf += c;
            i++;
        }
        flush();
        return out + "</span>";
    }

    const api = { highlight, declaredOperators };
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.PieHighlight = api;
})(typeof self !== "undefined" ? self : this);
