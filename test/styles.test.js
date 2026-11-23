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
// The rules outside every @media block.
function base() {
  let out = "", i = 0;
  for (let at; (at = css.indexOf("@media", i)) >= 0; ) {
    let depth = 0, j = css.indexOf("{", at);
    do depth += css[j] === "{" ? 1 : css[j] === "}" ? -1 : 0, j++; while (depth && j < css.length);
    out += css.slice(i, at);
    i = j;
  }
  return out + css.slice(i);
}

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

test("phone Days: the day strip stays at the top of the screen as the day scrolls", () => {
  // -8px cancels the scroller's top padding, as the Save bar's bottom: -24px does
  assert.match(decl(base(), ".tv-tabs"), /position:\s*sticky;\s*top:\s*-8px;/);
});

test("wide day heading: the route on one line, not the site's 22ch h2", () => {
  assert.match(decl(media(1024), ".tv-head"), /max-width:\s*none/);
});

test("larger text or page zoom: a block grows with its words instead of cutting them off", () => {
  const grid = decl(base(), ".tv-grid");
  assert.match(grid, /grid-template-rows:\s*repeat\(28,\s*minmax\(3\.25rem,\s*auto\)\)\s*1rem;/);
  assert.match(grid, /grid-auto-rows:\s*minmax\(3\.25rem,\s*auto\);/, "a stop past 10 PM too");
  assert.match(decl(base(), ".tv-stop, .tv-drv"), /line-height:\s*1\.3;/);
});

test("keyboard focus: rings inside the scrollers that would clip them", () => {
  assert.match(decl(base(), ".tv-tab:focus-visible, .tv-days:focus-visible"), /outline-offset:\s*-3px/);
});

test("the activity cards fill the screen's height; nothing else in the quiz shrinks", () => {
  assert.match(decl(base(), ".q-main > :not(.q-deck)"), /flex-shrink:\s*0/);
  assert.match(decl(base(), ".q-deck"), /flex:\s*1;/);
  assert.match(decl(base(), ".q-card-top"), /touch-action:\s*pan-y/, "a sideways drag moves the card; up and down still scroll");
});

test("dark mode: the open row on wide screens has the app's edge, not only its fill", () => {
  assert.match(decl(media(1024), '.tv-row[aria-current="true"]'), /box-shadow:\s*inset 0 0 0 1px var\(--tv-selEdgeDark\)/);
});
