import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const root = "dist/client";
const base = "/Prime-Fitness-App/";
let shell;
for (const file of ["_shell.html", "_shell/index.html"]) {
  try {
    shell = await readFile(join(root, file), "utf8");
    break;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (!shell) throw new Error("The Pages build did not produce a static SPA shell.");
shell = shell.replace("</head>", '<meta name="robots" content="noindex,nofollow" /></head>');
const tree = await readFile("src/routeTree.gen.ts", "utf8");
const destinations = tree.split("export interface FileRoutesByTo {")[1]?.split("}")[0] ?? "";
const routes = new Set(
  [...destinations.matchAll(/^  '(\/[^']*)': typeof/gm)]
    .map((match) => match[1])
    .filter((path) => !path.includes("$")),
);
if (!routes.has("/auth") || !routes.has("/train"))
  throw new Error("Static route discovery failed.");
for (const route of routes) {
  const directory = join(root, route.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "index.html"), shell);
}
// GitHub serves this shell for dynamic member-detail URLs without redirecting or losing Auth fragments.
await writeFile(join(root, "404.html"), shell);
await writeFile(join(root, ".nojekyll"), "");
const manifest = JSON.parse(await readFile(join(root, "manifest.webmanifest"), "utf8"));
manifest.id = base;
manifest.scope = base;
manifest.start_url = base + "train";
manifest.icons = manifest.icons.map((icon) => ({
  ...icon,
  src: base + icon.src.replace(/^\/+/, ""),
}));
await writeFile(join(root, "manifest.webmanifest"), JSON.stringify(manifest, null, 2) + "\n");
for (const file of ["sw.js", "auth/index.html", "train/index.html", "reset-password/index.html"]) {
  await access(join(root, file));
}
console.log(`Prepared ${routes.size} static routes and the dynamic-route fallback under ${base}`);
