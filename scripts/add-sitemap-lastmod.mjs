import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const targetFiles = ["sitemap-0.xml"];
const today = new Date().toISOString().split("T")[0];

for (const fileName of targetFiles) {
  const filePath = join(distDir, fileName);
  if (!existsSync(filePath)) continue;

  const xml = readFileSync(filePath, "utf8");
  const updatedXml = xml.replace(/<url><loc>(.*?)<\/loc>(.*?)<\/url>/g, (match, loc, rest) => {
    if (rest.includes("<lastmod>")) return match;
    return `<url><loc>${loc}</loc><lastmod>${today}</lastmod>${rest}</url>`;
  });

  writeFileSync(filePath, updatedXml, "utf8");
}
