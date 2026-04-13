import type { CookieOptions, Request, Response } from "express";

export const REFRESH_COOKIE_NAME = "usvibe_refresh";

function resolveSameSite(): NonNullable<CookieOptions["sameSite"]> {
  const raw = process.env.REFRESH_COOKIE_SAMESITE?.trim().toLowerCase();
  if (raw === "none" || raw === "strict") {
    return raw;
  }
  return "lax";
}

export function refreshCookieBaseOptions(): CookieOptions {
  const sameSite = resolveSameSite();
  const secure =
    sameSite === "none" ? true : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
    maxAge: 7 * 24 * 3600 * 1000
  };
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieBaseOptions());
}

export function clearRefreshTokenCookie(res: Response): void {
  const o = refreshCookieBaseOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: o.sameSite,
    secure: o.secure
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) {
    return undefined;
  }
  const prefix = `${name}=`;
  for (const part of raw.split(";")) {
    const s = part.trim();
    if (s.startsWith(prefix)) {
      return decodeURIComponent(s.slice(prefix.length));
    }
  }
  return undefined;
}
