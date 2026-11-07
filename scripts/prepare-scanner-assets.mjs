import { mkdir, copyFile, readdir, writeFile } from "node:fs/promises";
await mkdir("public/scanner-runtime/core", { recursive: true });
await mkdir("public/scanner-runtime/lang", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/LICENSE.md",
  "public/scanner-runtime/LICENSE-tesseract.txt",
);
await copyFile("node_modules/tesseract.js-core/LICENSE", "public/scanner-runtime/LICENSE-core.txt");
await copyFile(
  "node_modules/@zxing/browser/LICENSE",
  "public/scanner-runtime/LICENSE-zxing-browser.txt",
);
await copyFile(
  "node_modules/@zxing/library/LICENSE",
  "public/scanner-runtime/LICENSE-zxing-library.txt",
);
await writeFile(
  "public/scanner-runtime/NOTICE.txt",
  "Optional scanner runtime: Tesseract.js 7.0.0 and tesseract.js-core (Apache-2.0); English/Arabic models from @tesseract.js-data 1.0.0 / naptha/tessdata and tesseract-ocr/tessdata_best. Model data is distributed under Apache-2.0; see LICENSE-core.txt. ZXing browser/library notices are included alongside this file. Source and package versions are recorded in package-lock.json.\n",
);
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/scanner-runtime/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core")) {
  if (/\.wasm(?:\.js)?$/.test(file))
    await copyFile(`node_modules/tesseract.js-core/${file}`, `public/scanner-runtime/core/${file}`);
}
for (const lang of ["eng", "ara"])
  await copyFile(
    `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
    `public/scanner-runtime/lang/${lang}.traineddata.gz`,
  );
console.log("Prepared optional, on-device scanner runtime assets.");
