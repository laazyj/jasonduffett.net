#!/usr/bin/env tsx
/**
 * Scrape the current jasonduffett.net site for a list of post URLs and
 * produce redirects.json, mapping each old path to a best-guess new path
 * on the rebuilt site.
 *
 * Matching rules (heuristic — review the output before deploy):
 *
 *   /YYYY/MM/DD/slug/           -> /tech/slug/   or  /music/slug/
 *   /category/<cat>/<slug>/     -> /<cat>/slug/  (if <cat> is tech|music)
 *   /?p=123                     -> /  (can't recover slug; map to home)
 *   anything else               -> /  (left in "unknown" list for manual review)
 *
 * Category is inferred by keyword in the fetched page title or body. Posts
 * we can't classify with confidence are flagged in stderr so a human can
 * either edit redirects.json by hand or add them to CATEGORY_OVERRIDES
 * below and re-run.
 *
 * Usage:
 *   npx nx run @jasonduffett-net/cdk:redirects
 *   # then review packages/cdk/redirects.json, commit, cdk deploy
 */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const redirectsPath = resolve(here, "..", "redirects.json");

const SOURCE = process.env.REDIRECT_SOURCE ?? "https://jasonduffett.net";
const SITEMAP_URL = `${SOURCE}/sitemap.xml`;

/** Manual overrides when the heuristic can't classify a post. Slug -> category. */
const CATEGORY_OVERRIDES: Partial<Record<string, "tech" | "music">> = {
  // "some-old-slug": "tech",
};

const TECH_HINTS =
  /\b(netscaler|ssl|tls|cipher|new relic|powershell|sql|backup|aws|linux|windows|server|script)\b/i;
const MUSIC_HINTS = /\b(ukulele|uke|guitar|song|chord|cover|arrangement|recording|lyric)\b/i;

async function main() {
  console.error(`Fetching sitemap from ${SITEMAP_URL} …`);
  const sitemapRes = await fetch(SITEMAP_URL);
  if (!sitemapRes.ok) {
    console.error(
      `Sitemap fetch failed (${sitemapRes.status.toString()}). Falling back to crawling the homepage.`,
    );
    return crawlHomepage();
  }

  const xml = await sitemapRes.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => u.startsWith(SOURCE))
    .map((u) => new URL(u).pathname)
    .filter((p) => p !== "/" && !p.endsWith("/feed/") && !p.endsWith("/sitemap.xml"));

  console.error(`Found ${urls.length.toString()} URLs in sitemap.`);
  await buildMapFromPaths(urls);
}

async function crawlHomepage() {
  console.error(`Crawling ${SOURCE}/ for links …`);
  const res = await fetch(SOURCE + "/");
  if (!res.ok) {
    console.error(`Homepage fetch failed (${res.status.toString()}). Aborting.`);
    process.exit(1);
  }
  const html = await res.text();
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => h.startsWith("/") || h.startsWith(SOURCE))
    .map((h) => new URL(h, SOURCE).pathname)
    .filter((p) => p !== "/");
  await buildMapFromPaths([...new Set(hrefs)]);
}

async function buildMapFromPaths(paths: string[]) {
  const entries = await Promise.all(
    paths.map(async (path) => {
      const slug = deriveSlug(path);
      if (!slug) return { path, target: "/", unknown: true };
      const category = CATEGORY_OVERRIDES[slug] ?? (await classify(path, slug));
      if (!category) return { path, target: "/", unknown: true };
      return { path, target: `/${category}/${slug}/`, unknown: false };
    }),
  );

  const redirects: Record<string, string> = {};
  const unknown: string[] = [];
  for (const { path, target, unknown: isUnknown } of entries) {
    redirects[path] = target;
    if (isUnknown) unknown.push(path);
  }

  const existing = JSON.parse(readFileSync(redirectsPath, "utf8")) as {
    _comment?: string;
    redirects: Record<string, string>;
  };
  existing.redirects = redirects;
  writeFileSync(redirectsPath, JSON.stringify(existing, null, 2) + "\n");

  console.error(
    `\nWrote ${Object.keys(redirects).length.toString()} redirects to ${redirectsPath}.`,
  );
  if (unknown.length > 0) {
    console.error(
      `\n${unknown.length.toString()} URL(s) could not be classified automatically — review redirects.json and edit by hand (or add entries to CATEGORY_OVERRIDES in this script):`,
    );
    for (const p of unknown) console.error(`   ${p}`);
  }
}

function deriveSlug(path: string): string | undefined {
  // /YYYY/MM/DD/slug/ or /YYYY/MM/slug/
  let m = /^\/\d{4}\/\d{2}(?:\/\d{2})?\/([^/]+)\/?$/.exec(path);
  if (m) return m[1];

  // /category/<cat>/<slug>/
  m = /^\/category\/[^/]+\/([^/]+)\/?$/.exec(path);
  if (m) return m[1];

  // /<something>/<slug>/
  m = /^\/[^/]+\/([^/]+)\/?$/.exec(path);
  if (m) return m[1];

  return undefined;
}

async function classify(path: string, slug: string): Promise<"tech" | "music" | undefined> {
  // Cheap heuristic first: pattern-match the slug itself.
  if (TECH_HINTS.test(slug)) return "tech";
  if (MUSIC_HINTS.test(slug)) return "music";

  // Fall back to fetching the page and scanning title + body.
  try {
    const res = await fetch(SOURCE + path);
    if (!res.ok) return undefined;
    const html = await res.text();
    if (TECH_HINTS.test(html)) return "tech";
    if (MUSIC_HINTS.test(html)) return "music";
  } catch {
    // network errors are fine — caller falls back to "/"
  }
  return undefined;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
