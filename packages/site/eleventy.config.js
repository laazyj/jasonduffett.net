import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rssPlugin from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CATEGORIES = ["tech", "music", "misc"];

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(rssPlugin);
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.addPassthroughCopy({ assets: "assets" });

  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());
  eleventyConfig.addGlobalData("categories", CATEGORIES);

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
