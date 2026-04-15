import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

interface RedirectsFile {
  redirects: Record<string, string>;
}

/**
 * Builds the source for a CloudFront Function that runs at the viewer-request
 * stage. Two responsibilities:
 *
 *   1. If the host header is www.jasonduffett.net, return a 301 to the same
 *      path on the apex domain (canonical URL hygiene).
 *   2. Otherwise, look up the requested URI in a compiled-in redirect map
 *      and return a 301 if there's a match. Falls through to origin on miss.
 *
 * The redirect map is injected at synth time from infra/redirects.json so
 * the function has no runtime dependencies — CloudFront Functions don't
 * support network calls or large runtimes.
 */
export function buildRedirectFunctionCode(): string {
  // Resolve relative to repo layout: infra/lib/*.ts (source) or
  // infra/dist/lib/*.js (built). Walk up until we find redirects.json.
  const candidates = [
    resolve(here, "..", "redirects.json"),
    resolve(here, "..", "..", "redirects.json"),
  ];
  const redirectsPath = candidates.find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  });
  if (!redirectsPath) {
    throw new Error(`redirects.json not found. Looked in: ${candidates.join(", ")}`);
  }
  const file = JSON.parse(readFileSync(redirectsPath, "utf8")) as RedirectsFile;
  const map = file.redirects ?? {};

  // JSON.stringify produces valid JS object literal syntax.
  const redirectMapSource = JSON.stringify(map, null, 2);

  return `
var REDIRECTS = ${redirectMapSource};

function handler(event) {
  var req = event.request;
  var host = req.headers.host && req.headers.host.value;
  var uri = req.uri;

  // 1. www -> apex
  if (host === "www.jasonduffett.net") {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://jasonduffett.net" + uri }
      }
    };
  }

  // 2. Old-URL map
  if (REDIRECTS[uri]) {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: REDIRECTS[uri] }
      }
    };
  }

  return req;
}
`.trim();
}
