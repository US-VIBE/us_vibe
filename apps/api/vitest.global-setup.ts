import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import { PG_READY_FLAG } from "./test/pg-ready-flag";

export default async function globalSetup(): Promise<() => void> {
  const ok = await new Promise<boolean>((resolve) => {
    const s = net.createConnection({ port: 5432, host: "127.0.0.1" });
    const done = (v: boolean) => {
      try {
        s.destroy();
      } catch {
        /* empty */
      }
      resolve(v);
    };
    s.setTimeout(2000, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
  writeFileSync(PG_READY_FLAG, ok ? "1" : "0", "utf8");
  return () => {
    try {
      if (existsSync(PG_READY_FLAG)) unlinkSync(PG_READY_FLAG);
    } catch {
      /* empty */
    }
  };
}
