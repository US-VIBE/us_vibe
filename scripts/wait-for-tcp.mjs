/**
 * Poll until a TCP port accepts connections (e.g. Postgres after `docker compose up`).
 * Usage: node scripts/wait-for-tcp.mjs [host] [port] [label]
 */
import net from "node:net";

const host = process.argv[2] ?? "127.0.0.1";
const port = Number(process.argv[3] ?? "5432");
const label = process.argv[4] ?? `${host}:${port}`;
const maxMs = Number(process.env.WAIT_FOR_TCP_MS ?? "60000");
/** Poll interval when the port is not ready yet (ms). Lower = faster “ready” detection; slightly more CPU. */
const intervalMs = Number(process.env.WAIT_FOR_TCP_INTERVAL_MS ?? "200");

function tryConnect() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(undefined);
    });
    socket.setTimeout(2500);
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("timeout"));
    });
  });
}

const start = Date.now();
for (;;) {
  try {
    await tryConnect();
    console.error(`[wait-for-tcp] ${label} ready`);
    process.exit(0);
  } catch {
    if (Date.now() - start > maxMs) {
      console.error(`[wait-for-tcp] timed out after ${maxMs}ms waiting for ${label}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
