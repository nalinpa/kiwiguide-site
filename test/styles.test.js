import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

// Body of every `@media (min-width: Npx) { ... }` block, brace-matched.
function media(px) {
  const out = [];
  const re = new RegExp("@media \\(min-width: " + px + "px\\)\\s*\\{", "g");
  for (let m; (m = re.exec(css)); ) {
    let depth = 1, i = re.lastIndex;
    while (depth && i < css.length) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0, i++;
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out.join("\n");
}
const decl = (block, sel) => {
  const i = block.indexOf(sel + " {");
  return i < 0 ? "" : block.slice(i, block.indexOf("}", i));
};

test("quiz is wider on an iPad", () => {
  const m768 = media(768), m1024 = media(1024);
  const w = decl(m768, ".quiz").match(/max-width:\s*(\d+)px/);
  assert.ok(w && +w[1] > 520, ".quiz max-width above 520px from 768px");
  assert.match(decl(m1024, ".q-days"), /grid-template-columns:\s*\S+\s+\S+\s*;/, "reveal days in two columns from 1024px");
  for (const block of [m768, m1024]) {
    const f = decl(block, ".q-main:has(> .q-form)").match(/max-width:\s*(\d+)px/);
    assert.ok(f && +f[1] <= 520, "account step stays at most 520px");
  }
});
