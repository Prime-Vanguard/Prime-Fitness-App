import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";

export function pwaAssets(): Plugin {
  let base = "/";
  return {
    name: "prime-fitness-pwa",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
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
      const scopedAssets = assets.map((path) => base + path.slice(1));
      const template = readFileSync(new URL("./service-worker.js", import.meta.url), "utf8");
      const id = createHash("sha256")
        .update(JSON.stringify(scopedAssets))
        .update(template)
        .digest("hex")
        .slice(0, 12);
      const source = template
        .replace("__BUILD_ID__", id)
        .replace("__PRECACHE__", JSON.stringify(scopedAssets))
        .replace("__BASE_PATH__", JSON.stringify(base));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
