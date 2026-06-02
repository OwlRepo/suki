const LOCAL_API_URL = "http://localhost:3001";
const PRODUCTION_API_PROXY = "/api";

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicitUrl) return trimTrailingSlash(explicitUrl);

  return process.env.NODE_ENV === "development" ? LOCAL_API_URL : PRODUCTION_API_PROXY;
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
