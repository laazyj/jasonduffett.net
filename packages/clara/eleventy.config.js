import process from "node:process";

export default function (eleventyConfig) {
  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ typographer: true });
    md.enable(["replacements", "smartquotes"]);
  });

  eleventyConfig.addPassthroughCopy({ assets: "assets" });

  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());
  // Distinct GA4 property from the main site — its own measurement ID, injected
  // at build time from CLARA_GA_MEASUREMENT_ID. Unset disables analytics (and
  // the consent banner) entirely, exactly as on the parent site.
  eleventyConfig.addGlobalData("analytics", () => ({
    measurementId: process.env.CLARA_GA_MEASUREMENT_ID || null,
  }));
  eleventyConfig.addGlobalData("build", () => ({
    sha: process.env.GITHUB_SHA || "dev",
  }));

  // Convert a root-absolute path ("/assets/x.css") into one relative to the
  // current page, so the site renders under any URL prefix without a build-time
  // pathPrefix. Mirrors the filter on the parent site.
  eleventyConfig.addFilter("rel", function (target) {
    if (typeof target !== "string" || !target.startsWith("/")) return target;
    const pageUrl =
      (this.page && this.page.url) || (this.ctx && this.ctx.page && this.ctx.page.url) || "/";
    const depth = pageUrl.split("/").filter(Boolean).length;
    const prefix = depth === 0 ? "./" : "../".repeat(depth);
    return prefix + target.replace(/^\//, "");
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
