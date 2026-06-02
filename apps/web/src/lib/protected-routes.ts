const PUBLIC_PREFIXES = ["/", "/sign-in", "/sign-up", "/forgot-password", "/intake"] as const;
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/customers",
  "/appointments",
  "/settings",
  "/imports",
  "/setup",
  "/onboarding",
  "/insights",
  "/analytics",
  "/promos",
  "/loyalty",
  "/pipeline",
] as const;

function isExactOrNestedPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) =>
    prefix === "/" ? pathname === "/" : isExactOrNestedPath(pathname, prefix),
  );
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => isExactOrNestedPath(pathname, prefix));
}
