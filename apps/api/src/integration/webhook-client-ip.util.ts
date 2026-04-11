import type { Request } from "express";

/** IPv4만 CIDR 매칭. IPv6 단일 주소는 규칙과 문자열 일치 시만 허용. */
function ipv4ToInt(ip: string): number {
  const p = ip.split(".");
  if (p.length !== 4) {
    return -1;
  }
  let n = 0;
  for (const x of p) {
    const v = parseInt(x, 10);
    if (!Number.isFinite(v) || v < 0 || v > 255) {
      return -1;
    }
    n = ((n << 8) + v) >>> 0;
  }
  return n;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr ?? "", 10);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const ipN = ipv4ToInt(ip);
  const baseN = ipv4ToInt(base.trim());
  if (ipN < 0 || baseN < 0) {
    return false;
  }
  if (bits === 0) {
    return true;
  }
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipN & mask) === (baseN & mask);
}

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/i, "").trim();
}

/**
 * Express `trust proxy` 설정 시 `req.ip`이 프록시가 정리한 클라이언트 IP.
 * 미설정 시 소켓 주소 사용.
 */
export function resolveWebhookClientIp(
  req: Request,
  trustProxy: boolean,
): string | undefined {
  if (trustProxy && typeof req.ip === "string" && req.ip.length > 0) {
    return normalizeIp(req.ip);
  }
  const raw = req.socket?.remoteAddress;
  if (!raw) {
    return undefined;
  }
  return normalizeIp(raw);
}

export function parseWebhookAllowlistRules(raw: string | undefined): string[] {
  const s = raw?.trim() ?? "";
  if (!s) {
    return [];
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function isClientIpAllowed(ip: string, rules: string[]): boolean {
  if (rules.length === 0) {
    return true;
  }
  const normalized = normalizeIp(ip);
  for (const rule of rules) {
    if (rule.includes("/")) {
      if (ipv4InCidr(normalized, rule)) {
        return true;
      }
    } else if (normalized === rule) {
      return true;
    }
  }
  return false;
}
