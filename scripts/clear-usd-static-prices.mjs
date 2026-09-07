import { readFileSync, writeFileSync } from "node:fs";

const p = new URL("../src/app/data/assets.ts", import.meta.url);
let s = readFileSync(p, "utf8");
s = s.replace(/price: "\$[^"]+"/g, 'price: "—"');
// Zero out USD stub priceRaw values in companies (keep ETF/fund/crypto stubs)
s = s.replace(
  /(id: "(?:apple|microsoft|alphabet|nvidia|amazon|meta|tesla|netflix)"[\s\S]*?priceRaw: )([\d.]+)/g,
  "$10",
);
writeFileSync(p, s);
console.log("static USD company prices cleared");
