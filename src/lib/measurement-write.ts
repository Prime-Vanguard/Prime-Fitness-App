import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { validateBodyValues, type BodyValues } from "./numeric-input";
import { validActivityDate } from "./training-search";
export type MeasurementWrite = BodyValues & { id: string; member_id: string; measured_on: string };
export async function saveNativeMeasurement(owner: string, payload: MeasurementWrite) {
  z.string().uuid().parse(payload.id);
  if (payload.member_id !== owner || !validActivityDate(payload.measured_on))
    throw new Error("Invalid measurement ownership or date.");
  validateBodyValues({
    weight_kg: payload.weight_kg,
    waist_cm: payload.waist_cm,
    body_fat_pct: payload.body_fat_pct,
  });
  const result = await supabase.from("body_measurements").insert(payload).select("id").single();
  if (result.error) {
    if (result.error.code !== "23505") throw result.error;
    const current = await supabase
      .from("body_measurements")
      .select("id,member_id,measured_on,weight_kg,waist_cm,body_fat_pct")
      .eq("id", payload.id)
      .eq("member_id", owner)
      .maybeSingle();
    if (current.error) throw current.error;
    if (
      !current.data ||
      Object.entries(payload).some(
        ([key, value]) =>
          String((current.data as unknown as Record<string, unknown>)[key]) !== String(value),
      )
    )
      throw new Error("A different measurement already exists. Refresh history before retrying.");
  } else if (result.data?.id !== payload.id)
    throw new Error("Measurement not confirmed. Your values are retained; retry this draft.");
}
