import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import rssPlugin from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CATEGORIES = ["tech", "music", "misc"];

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(rssPlugin);
  eleventyConfig.addPlugin(syntaxHighlight, {
    // Two song-sheet "languages" so chord names, section markers and fret
    // numbers become real tokens we can style (see the .language-chords /
    // .language-tab rules in styles.css). They aren't shipped Prism grammars,
    // so we register them on the shared Prism instance here.
    init: ({ Prism }) => {
      // Shared between both sheet grammars. Token *order* differs per grammar
      // (chords must try `chord` before `hint`), so these are referenced
      // by name rather than spread, to keep each grammar's order explicit.
      const section = /\[[^\]]*\]/; // [Intro], [banjo riff, strumming], …
      const hint = /\([^)]*\)/; // parenthetical cues: (n/c), (x2), (D7 - bass run)
      const bar = /\|/;
      // Chord / lyric sheet: bold chord names, muted section + cue markers.
      Prism.languages.chords = {
        section,
        chord:
          /\((?:N\.?C\.?|[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?)\)/,
        hint,
        bar,
      };
      // ASCII tablature: dashes form the string line; pick out fret numbers,
      // techniques (h/p/b, x = muted), barlines and bracketed/parenthetical cues.
      Prism.languages.tab = {
        section,
        hint,
        // Chord labels above the staves, matched as whole words so their digits
        // (e.g. the 7 in D7) aren't mistaken for frets. String labels like `E|`
        // are excluded by the trailing-whitespace lookahead (they precede `|`).
        chord:
          /(?<=^|\s)[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?(?=\s|$)/m,
        technique: /[hpb](?=\d)|x/,
        fret: /\d+/,
        bar,
        dash: /-+/,
      };
    },
  });

  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ typographer: true });
    md.enable(["replacements", "smartquotes"]);
  });

  eleventyConfig.addPassthroughCopy({ assets: "assets" });
  eleventyConfig.addPassthroughCopy({ static: "/" });

  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());
  eleventyConfig.addGlobalData("categories", CATEGORIES);
  eleventyConfig.addGlobalData("analytics", () => ({
    measurementId: process.env.GA_MEASUREMENT_ID || null,
  }));
  eleventyConfig.addGlobalData("build", () => ({
    sha: process.env.GITHUB_SHA || "dev",
  }));

  eleventyConfig.addFilter("category", (tags) =>
    Array.isArray(tags) ? CATEGORIES.find((c) => tags.includes(c)) : undefined,
  );

  // Inline a file's contents verbatim. Used to ship the stylesheet inside
  // each page's <style> — one fewer HTTP request, instant first paint,
  // and the preview works on any static host without MIME-type quirks.
  eleventyConfig.addShortcode("inlineFile", (relPath) =>
    fs.readFileSync(path.join(__dirname, relPath), "utf8"),
  );

  // Convert a root-absolute path ("/assets/x.css") into a path relative to
  // the current page. Lets the site render under any URL prefix — including
  // raw.githack preview links — without a build-time pathPrefix flag.
  eleventyConfig.addFilter("rel", function (target) {
    if (typeof target !== "string" || !target.startsWith("/")) return target;
    const pageUrl =
      (this.page && this.page.url) || (this.ctx && this.ctx.page && this.ctx.page.url) || "/";
    const depth = pageUrl.split("/").filter(Boolean).length;
    const prefix = depth === 0 ? "./" : "../".repeat(depth);
    return prefix + target.replace(/^\//, "");
  });

  const toDate = (date) => (date instanceof Date ? date : new Date(date));

  eleventyConfig.addFilter("readableDate", (date) =>
    toDate(date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
  );

  eleventyConfig.addFilter("shortDate", (date) =>
    toDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  );

  eleventyConfig.addFilter("htmlDateString", (date) => toDate(date).toISOString().slice(0, 10));

  eleventyConfig.addFilter("year", (date) => toDate(date).getFullYear());

  eleventyConfig.addFilter("readingTime", (input) => {
    if (!input) return 0;
    const text = String(input).replace(/<[^>]+>/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 225));
  });

  // Group a collection into [{ year, posts[] }] in reverse-chronological order.
  eleventyConfig.addFilter("byYear", (posts) => {
    const groups = new Map();
    for (const p of [...posts].reverse()) {
      const year = new Date(p.date).getFullYear();
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(p);
    }
    return [...groups.entries()].map(([year, posts]) => ({ year, posts }));
  });

  // Each category's `<cat>.json` tags its directory's posts; these collections
  // filter `all` by tag so they're sorted by date automatically.
  for (const tag of CATEGORIES) {
    eleventyConfig.addCollection(tag, (api) =>
      api.getFilteredByTag(tag).filter((item) => !item.data.eleventyExcludeFromCollections),
    );
  }
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getAll()
      .filter((item) => (item.data.tags || []).some((t) => CATEGORIES.includes(t)))
      .sort((a, b) => a.date - b.date),
  );

  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const { buildOg } = await import("./scripts/build-og.mjs");
    const count = await buildOg({
      distDir: dir.output,
      sitePackageDir: __dirname,
      categories: CATEGORIES,
    });
    console.log(`[og] generated ${count} card${count === 1 ? "" : "s"}`);
  });

  eleventyConfig.addCollection("seriesIndex", (api) => {
    const groups = new Map();
    for (const item of api.getAll()) {
      const key = item.data.series;
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const threads = [...groups.entries()].map(([key, posts]) => ({
      key,
      posts: posts.sort((a, b) => a.data.seriesPart - b.data.seriesPart),
    }));
    const latestDate = (thread) => Math.max(...thread.posts.map((p) => p.date.getTime()));
    return threads.sort((a, b) => latestDate(b) - latestDate(a));
  });

  return {
    dir: {
      input: "content",
      output: "dist",
      includes: "../_includes",
      data: "../_data",
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
