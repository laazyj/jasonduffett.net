#!/usr/bin/env node
// Post-deploy notification: tell IndexNow (Bing, Yandex, Naver, etc.) that
// the sitemap is fresh. Submitting the sitemap URL itself is the simplest
// valid payload — IndexNow pulls the full URL list from the sitemap, so we
// don't need to diff against the previous deploy.
//
// IndexNow keys are per-host: each host serves its own /<key>.txt and is
// submitted in a separate request whose `host` matches the submitted URLs.
// We reuse the one key across the apex and every subsite that serves it.
//
// Usage:
//   INDEXNOW_KEY=<key> node packages/cdk/scripts/indexnow-ping.mjs
//   INDEXNOW_KEY=<key> BASE_URL=https://staging.example.com node ...
//
// Failures are logged but the script always exits 0 — IndexNow is a latency
// optimisation, not the source of truth (Bing falls back to sitemap polling).

import { fetchWithTimeout, resolveBaseUrl, subsiteOrigin, SUBSITE_KEYS } from "./_lib.mjs";

const { baseUrl: BASE_URL, isCanonicalApex } = resolveBaseUrl();
const KEY = process.env.INDEXNOW_KEY;

if (!KEY) {
  console.error(
    "INDEXNOW_KEY env var is required (see packages/site/static/<key>.txt for the value).",
  );
  process.exit(1);
}

// Subsites live on their own IndexNow hosts (each serves the key file and its
// own sitemap). Only ping them against the production apex — a staging
// BASE_URL override has no corresponding subsite origin.
const SUBSITE_BASE_URLS = isCanonicalApex ? SUBSITE_KEYS.map(subsiteOrigin) : [];
const baseUrls = [BASE_URL, ...SUBSITE_BASE_URLS];

async function pingHost(baseUrl) {
  const host = new URL(baseUrl).host;
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const body = {
    host,
    key: KEY,
    keyLocation: `${baseUrl}/${KEY}.txt`,
    urlList: [sitemapUrl],
  };

  console.log(`IndexNow: pinging api.indexnow.org for ${host} (sitemap: ${sitemapUrl})`);

  try {
    const res = await fetchWithTimeout("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.status === 200 || res.status === 202) {
      console.log(`IndexNow: ${host}: ${res.status} ${res.statusText} (accepted).`);
    } else {
      console.warn(
        `IndexNow: ${host}: unexpected ${res.status} ${res.statusText}. Body: ${text || "(empty)"}`,
      );
      console.warn("Continuing — Bing will still discover updates via the sitemap.");
    }
  } catch (err) {
    console.warn(`IndexNow: ${host}: ping failed: ${String(err)}`);
    console.warn("Continuing — Bing will still discover updates via the sitemap.");
  }
}

for (const baseUrl of baseUrls) {
  await pingHost(baseUrl);
}
