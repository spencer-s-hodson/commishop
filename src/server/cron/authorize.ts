/** Shared secret check for /api/cron/* (Bearer or ?secret=). */
export function isAuthorizedCronRequest(
  provided: string | null | undefined,
  secret: string | undefined | null,
): boolean {
  if (!secret) return false;
  return provided === secret;
}

export function cronSecretFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  return bearer ?? querySecret;
}
