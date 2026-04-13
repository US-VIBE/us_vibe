export type JwtPayload = {
  sub: string;
  email: string;
  jti: string;
  /** 미설정(구 토큰)은 액세스 토큰으로 간주 */
  tokenUse?: "access" | "refresh";
};
