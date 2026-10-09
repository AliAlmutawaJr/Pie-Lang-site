# Writing the docs

`docs.md` is ordinary Markdown with a few conventions:

- `##` headings are chapters and `###` headings are sections. Both appear in the
  sidebar. Link to them with their lowercase, dashed names: `[Loops](#loops)`.
- Code fences say what to do with the code:

| Fence | Shown with | Checked by `npm run check` |
| --- | --- | --- |
| ` ```pie ` | Copy | Not run |
| ` ```pie run ` | Copy, Run | Must run without errors |
| ` ```pie run+ ` | Copy, Run, "Uses the starter operators" | Same, with `prelude.pie` in front |
| ` ```pie error ` | Copy, Run, "Stops with an error" | Must fail |
| ` ```pie error+ ` | Same, with the starter operators | Must fail |
| ` ```output ` | Output panel under the previous block | Must match the previous block's output |
| anything else | Plain block | Not run |

The Run button opens the playground with the example (and the starter
operators, for `+` blocks) already loaded.
