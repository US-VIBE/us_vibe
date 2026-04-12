import type { Request } from "express";
import type { JwtPayload } from "./auth.types";

export type AuthedRequest = Request & { user: JwtPayload };
