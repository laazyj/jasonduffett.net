import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrored from packages/site/assets/styles.css :root tokens. Kept in sync
// by hand because styles.css has no build pipeline that could consume JSON.
const COLORS = {
  ink: "#0f0d0c",
  paper: "#ece4d3",
  muted: "#8a8275",
  tech: "#ff7a3d",
  music: "#5dadff",
  misc: "#c4d65a",
};

async function loadFonts() {
  const fontDir = path.join(__dirname, "fonts");
  const [fraunces, inter, interBold] = await Promise.all([
    readFile(path.join(fontDir, "Fraunces-Italic-800.ttf")),
    readFile(path.join(fontDir, "Inter-Regular.ttf")),
    readFile(path.join(fontDir, "Inter-SemiBold.ttf")),
  ]);
  return [
    { name: "Fraunces", data: fraunces, weight: 800, style: "italic" },
    { name: "Inter", data: inter, weight: 400, style: "normal" },
    { name: "Inter", data: interBold, weight: 600, style: "normal" },
  ];
}

const div = (style, children) => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

function header() {
  return div(
    {
      alignItems: "center",
      color: COLORS.muted,
      fontFamily: "Inter",
      fontSize: "28px",
      letterSpacing: "0.04em",
    },
    "jasonduffett.net",
  );
}

function titleBlock(title, accent, squiggle) {
  return div({ flexDirection: "column", gap: "20px", maxWidth: "880px" }, [
    div(
      {
        fontFamily: "Fraunces",
        fontStyle: "italic",
        fontWeight: 800,
        fontSize: "78px",
        lineHeight: 1.05,
        color: COLORS.paper,
      },
      title,
    ),
    div(
      { height: "20px", color: accent },
      {
        type: "svg",
        props: {
          width: 360,
          height: 20,
          viewBox: "0 0 240 14",
          preserveAspectRatio: "none",
          children: {
            type: "path",
            props: {
              d: squiggle,
              fill: "none",
              stroke: accent,
              strokeWidth: 1.6,
              strokeLinecap: "round",
            },
          },
        },
      },
    ),
  ]);
}

function footer(category, accent, byline) {
  return div({ alignItems: "center", gap: "16px", fontFamily: "Inter", fontSize: "28px" }, [
    div(
      {
        padding: "6px 18px",
        border: `2px solid ${accent}`,
        color: accent,
        borderRadius: "999px",
        letterSpacing: "0.04em",
      },
      category,
    ),
    div({ color: COLORS.muted }, byline),
  ]);
}

function sketchOverlay(sketchDataUrl) {
  return div(
    {
      position: "absolute",
      right: "60px",
      bottom: "60px",
      width: "200px",
      height: "200px",
      borderRadius: "16px",
      overflow: "hidden",
      opacity: 0.85,
    },
    {
      type: "img",
      props: {
        src: sketchDataUrl,
        width: 200,
        height: 200,
        style: { objectFit: "cover", objectPosition: "top" },
      },
    },
  );
}

function card({ title, category, sketchDataUrl, squiggle, byline = "by Jason Duffett" }) {
  const accent = COLORS[category];
  if (!accent) throw new Error(`Unknown category for OG card: ${JSON.stringify(category)}`);
  return div(
    {
      width: "1200px",
      height: "630px",
      background: COLORS.ink,
      color: COLORS.paper,
      fontFamily: "Fraunces",
      position: "relative",
    },
    [
      sketchOverlay(sketchDataUrl),
      div(
        {
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          width: "100%",
        },
        [header(), titleBlock(title, accent, squiggle), footer(category, accent, byline)],
      ),
    ],
  );
}

async function renderPng({ tree, fonts }) {
  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  return new Resvg(svg).render().asPng();
}

const TITLE_RE = /<meta property="og:title" content="([^"]*)"\s*\/>/;

async function* walkPosts(distRoot, categories) {
  for (const cat of categories) {
    let slugs;
    try {
      slugs = await readdir(path.join(distRoot, cat));
    } catch (e) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    for (const slug of slugs) {
      let html;
      try {
        html = await readFile(path.join(distRoot, cat, slug, "index.html"), "utf8");
      } catch (e) {
        if (e.code === "ENOENT" || e.code === "ENOTDIR") continue;
        throw e;
      }
      const match = html.match(TITLE_RE);
      if (!match) continue;
      yield { slug, category: cat, title: decodeHtmlEntities(match[1]) };
    }
  }
}

function decodeHtmlEntities(s) {
  // `&amp;` must be unescaped last: the ampersand is the escape character, so
  // decoding it earlier would let a literal `&amp;lt;` collapse to `<` (double
  // unescaping). Keep it after every other entity.
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export async function buildOg({ distDir, sitePackageDir, categories = ["tech", "music", "misc"] }) {
  if (process.env.SKIP_OG_BUILD === "1") return 0;

  const fonts = await loadFonts();
  const site = JSON.parse(await readFile(path.join(sitePackageDir, "_data", "site.json"), "utf8"));
  const ornaments = JSON.parse(
    await readFile(path.join(sitePackageDir, "_data", "ornaments.json"), "utf8"),
  );
  const sketch = await readFile(path.join(sitePackageDir, site.author.image.replace(/^\//, "")));
  const sketchDataUrl = "data:image/jpeg;base64," + sketch.toString("base64");
  const ogDir = path.join(distDir, "og");
  await mkdir(ogDir, { recursive: true });

  let count = 0;

  const defaultPng = await renderPng({
    tree: card({
      title: "these things i do",
      category: "tech",
      sketchDataUrl,
      squiggle: ornaments.squiggle,
    }),
    fonts,
  });
  await writeFile(path.join(ogDir, "_default.png"), defaultPng);
  count++;

  for await (const post of walkPosts(distDir, categories)) {
    const png = await renderPng({
      tree: card({ ...post, sketchDataUrl, squiggle: ornaments.squiggle }),
      fonts,
    });
    await writeFile(path.join(ogDir, `${post.slug}.png`), png);
    count++;
  }

  return count;
}
