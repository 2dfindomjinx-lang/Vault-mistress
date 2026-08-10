// Checks the real link detector in src/lib/linkify.ts.
//
//   npm run test:linkify
//
// Two kinds of case matter here and both have bitten already:
//   * a URL written the way a person actually writes it must become a link
//   * ordinary prose, filenames and numbers must NOT

import { strict as assert } from "node:assert";
import { findLinks } from "../src/lib/linkify.ts";

const SHOULD_LINK = [
  ["announcement as written", "vault-mistress.vercel.app/birthday-2026 adresinden bak", "vault-mistress.vercel.app/birthday-2026"],
  ["trailing full stop", "Adres vault-mistress.vercel.app/birthday-2026.", "vault-mistress.vercel.app/birthday-2026"],
  ["explicit scheme", "https://vault-mistress.vercel.app/birthday-2026", "https://vault-mistress.vercel.app/birthday-2026"],
  ["www host", "www.throne.com/principessa2dfd adresinden", "www.throne.com/principessa2dfd"],
  ["bare host with path", "throne.com/principessa2dfd uzerinden", "throne.com/principessa2dfd"],
  ["bare host alone", "Bak vercel.app sayfasina", "vercel.app"],
  ["query string", "https://b.com/x?y=1&z=2 tamam", "https://b.com/x?y=1&z=2"],
  ["balanced brackets", "Detay (https://example.com/a_(b)) burada.", "https://example.com/a_(b)"],
  ["across newlines", "Satir bir\nvercel.app/iki\nSatir uc", "vercel.app/iki"],
];

const SHOULD_NOT_LINK = [
  ["email address", "principessa@example.com yazma"],
  ["typescript filenames", "src/lib/sound.ts ve page.tsx dosyalari"],
  ["sql filename", "birthday-2026.sql calistir"],
  ["decimals", "Fiyat 10.99 dolar ve 1.5 kat"],
  ["ratios", "3/4 bitti, 1/2 kaldi"],
  ["javascript scheme", "javascript:alert(1) tiklanmasin"],
  ["uppercase javascript scheme", "JAVASCRIPT://x.com kotu"],
  ["data uri", "data:text/html;base64,PHNjcmlwdD4="],
  ["site relative path", "/birthday-2026 sayfasina git"],
  ["plain sentence", "Bugun saat 14.30 da baslar"],
];

let failures = 0;

for (const [name, input, expected] of SHOULD_LINK) {
  const links = findLinks(input);
  try {
    assert.equal(links.length, 1, `expected exactly one link, got ${links.length}`);
    assert.equal(links[0].text, expected);
    assert.match(links[0].href, /^https?:\/\//);
    console.log(`  ok    ${name.padEnd(26)} ${links[0].text}  ->  ${links[0].href}`);
  } catch (error) {
    failures++;
    console.log(`  FAIL  ${name.padEnd(26)} ${error.message}`);
  }
}

for (const [name, input] of SHOULD_NOT_LINK) {
  const links = findLinks(input);
  if (links.length === 0) {
    console.log(`  ok    ${name.padEnd(26)} (no link)`);
  } else {
    failures++;
    console.log(`  FAIL  ${name.padEnd(26)} linked ${JSON.stringify(links.map((l) => l.text))}`);
  }
}

// Two links in one sentence must both survive, in order.
const pair = findLinks("Iki link: https://a.com ve throne.com/x tamam");
if (pair.length === 2 && pair[0].text === "https://a.com" && pair[1].text === "throne.com/x") {
  console.log("  ok    two links in one line     both found");
} else {
  failures++;
  console.log(`  FAIL  two links in one line     ${JSON.stringify(pair.map((l) => l.text))}`);
}

console.log(`\n${failures === 0 ? "all passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
