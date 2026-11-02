import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";

export function pwaAssets(): Plugin {
  return {
    name: "prime-fitness-pwa",
    apply: "build",
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;
      const assets = [
        ...Object.keys(bundle)
          .filter((name) => name.startsWith("assets/"))
          .map((name) => `/${name}`),
        "/train",
        "/nutrition",
        "/progress",
        "/offline.html",
        "/manifest.webmanifest",
        "/icon-192.png",
        "/icon-512.png",
        "/apple-touch-icon.png",
      ];
      const id = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 12);
      const source = readFileSync(new URL("./service-worker.js", import.meta.url), "utf8")
        .replace("__BUILD_ID__", id)
        .replace("__PRECACHE__", JSON.stringify(assets));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
