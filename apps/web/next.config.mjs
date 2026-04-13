import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  /** `webpack` 훅과 함께 두면 Next 16 기본 Turbopack 빌드가 구성 충돌로 실패하지 않도록 한다. */
  turbopack: {},
  /** OneDrive·iCloud 등 동기화 폴더에서 기본 감시가 “파일 변경”을 반복 인식하면 `/`가 끊임없이 다시 컴파일될 수 있음 → `next dev --webpack`일 때 폴링·무시로 완화. */
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 500,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"]
      };
    }
    return config;
  }
};

export default nextConfig;
