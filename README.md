# jasonduffett.net

Personal site of Jason Duffett — tech and music notes, in the "Quiet Editorial" style.

Built with [Eleventy](https://www.11ty.dev/) (Markdown → static HTML), styled with a single hand-rolled stylesheet, deployed to AWS CloudFront via [composureCDK](https://github.com/laazyj/composureCDK).

## Develop

```bash
npm install
npm run start     # hot-reload dev server at http://localhost:8080
```

## Build

```bash
npm run build     # writes ./_site
```

## Authoring

Posts are Markdown files under `content/tech/` or `content/music/`. Each needs only three frontmatter fields:

```yaml
---
title: "Your post title"
date: 2026-04-02
summary: "One-line description for meta tags and previews."
---
```

Everything else — layout, tag, permalink — comes from the directory's `*.json` data file.

## Layout

```
content/           # Markdown + Njk — the site's pages and posts
_includes/
  layouts/         # base.njk (HTML shell), post.njk (article page)
  partials/        # post-list.njk (year-grouped list)
assets/styles.css  # the entire design system
_data/site.json    # site title, tagline, url
.eleventy.js       # Eleventy config (filters, collections, plugins)
infra/             # AWS CDK app (added in a later phase)
```
