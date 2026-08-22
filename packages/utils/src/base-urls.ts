/**
 * Base URLs for the api and web apps.
 *
 * These were hardcoded to production, which meant a locally-run web app always
 * called the deployed api. Override them per-app via env to point a local web
 * app at a local api; unset, they resolve to the same production values as
 * before, so deployed apps are unaffected.
 *
 * NEXT_PUBLIC_ variants exist because the web app reads these in client
 * components, where only NEXT_PUBLIC_-prefixed vars are available.
 */

const PROD_API_BASE_URL = 'https://api.bf2.top';
const PROD_WEB_BASE_URL = 'https://bf2.top';

function trimTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getApiBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
  return trimTrailingSlash(configured || PROD_API_BASE_URL);
}

export function getWebBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.WEB_BASE_URL;
  return trimTrailingSlash(configured || PROD_WEB_BASE_URL);
}
