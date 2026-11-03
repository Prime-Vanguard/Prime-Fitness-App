import { spawnSync } from "node:child_process";

// Serial execution bounds WASM memory use and stops at the first failed suite.
const suites = [
  ["scripts/check-member-experience.mjs"],
  ["scripts/check-reliability.mjs"],
  ["scripts/check-progression.mjs"],
  ["scripts/check-security.mjs"],
  ["scripts/check-admin-reviews.mjs"],
  ["scripts/check-program-editors.mjs"],
  ["scripts/check-shop-administration.mjs"],
  ["scripts/check-photo-privacy.mjs"],
  ["scripts/check-data-integrity.mjs"],
  ["scripts/check-training-depth.mjs"],
  ["scripts/check-schedule-conflicts.mjs"],
  ["--test", "scripts/owner-provisioning.test.mjs"],
  ["scripts/check-owner-provisioning.mjs"],
  ["scripts/check-redemption-retries.mjs"],
];

for (const args of suites) {
  console.log(`\nRunning ${args.join(" ")}`);
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) console.error(result.error);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
