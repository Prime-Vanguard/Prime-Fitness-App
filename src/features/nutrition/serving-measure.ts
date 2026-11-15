import { inputNumber } from "@/lib/numeric-input";
/** Only explicit single metric quantities; never infer a cup, scoop or food density. */
export function servingMeasure(serving: string) {
  const match = serving
    .trim()
    .match(/^([0-9٠-٩۰-۹.٫]+)\s*(g|grams?|جم|غ|ml|millilit(?:er|re)s?|مل)$/iu);
  if (!match) return null;
  try {
    const amount = inputNumber(match[1], { label: "Base serving", min: 0.001, max: 100000 });
    return amount ? { amount, unit: /^(g|gram|جم|غ)/iu.test(match[2]!) ? "g" : "ml" } : null;
  } catch {
    return null;
  }
}
