const fs = require("node:fs");
const path = require("node:path");
const rssPlugin = require("@11ty/eleventy-plugin-rss");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(rssPlugin);
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.addPassthroughCopy({ "assets": "assets" });

  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());

  // Inline a file's contents verbatim. Used to ship the stylesheet inside
  // each page's <style> — one fewer HTTP request, instant first paint,
  // and the preview works on any static host without MIME-type quirks.
  eleventyConfig.addShortcode("inlineFile", (relPath) =>
    fs.readFileSync(path.join(__dirname, relPath), "utf8")
  );

  // Convert a root-absolute path ("/assets/x.css") into a path relative to
  // the current page. Lets the site render under any URL prefix — including
  // raw.githack preview links — without a build-time pathPrefix flag.
  eleventyConfig.addFilter("rel", function (target) {
    if (typeof target !== "string" || !target.startsWith("/")) return target;
    const pageUrl = (this.page && this.page.url) || (this.ctx && this.ctx.page && this.ctx.page.url) || "/";
    const depth = pageUrl.split("/").filter(Boolean).length;
    const prefix = depth === 0 ? "./" : "../".repeat(depth);
    return prefix + target.replace(/^\//, "");
  });

  // --- Filters -----------------------------------------------------------
  eleventyConfig.addFilter("readableDate", (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  eleventyConfig.addFilter("shortDate", (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  eleventyConfig.addFilter("htmlDateString", (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().slice(0, 10);
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

  // --- Collections -------------------------------------------------------
  // `tech.json` / `music.json` tag their directory's posts; these collections
  // simply filter `all` by tag so they're sorted by date automatically.
  eleventyConfig.addCollection("tech", (api) =>
    api.getFilteredByTag("tech").filter((item) => !item.data.eleventyExcludeFromCollections)
  );
  eleventyConfig.addCollection("music", (api) =>
    api.getFilteredByTag("music").filter((item) => !item.data.eleventyExcludeFromCollections)
  );
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getAll()
      .filter((item) => {
        const tags = item.data.tags || [];
        return tags.includes("tech") || tags.includes("music");
      })
      .sort((a, b) => a.date - b.date)
  );

  return {
    dir: {
      input: "content",
      output: "_site",
      includes: "../_includes",
      data: "../_data",
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
