import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { changeWorkout, readWorkout, type Workout } from "./workout-store";
import { pendingPhotoDeletions } from "./photo-deletion";
import { isImageMime } from "./photo-files";
import { inputNumber, validateBodyValues } from "./numeric-input";
import {
  setDetailsSchema,
  modeSchema,
  conventionSchema,
  validateSetDetails,
} from "./training-model";
import { readMemberState, changeMemberState, type MemberState } from "./member-store";
import { workoutEditorSchema } from "./workout-editor";
import { foodUndoEntries, foodEntry, mergeFoodRecovery } from "./nutrition-entries";
import { waterUndoEntries, waterEntry, mergeWaterRecovery } from "./water-entries";

export const RESTORE_TABLES = [
  "workout_sessions",
  "set_logs",
  "food_logs",
  "water_logs",
  "body_measurements",
  "saved_meals",
  "progress_photos",
  "wellness_checkins",
] as const;
const record = z.record(z.string(), z.unknown());
const uuid = z.string().uuid();
const timestamp = z.string().refine((s) => Number.isFinite(Date.parse(s)), "Invalid date");
const nullableNumber = z.number().finite().nonnegative().nullable();
const draftSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]).transform(() => 2 as const),
  userId: uuid,
  session: z
    .object({
      id: uuid,
      member_id: uuid,
      started_at: timestamp,
      title: z.string().nullable(),
      synced: z.boolean(),
      occurrence_id: z.string().uuid().optional(),
    })
    .nullable(),
  exercises: z.array(
    z.object({
      id: uuid,
      name_en: z.string(),
      name_ar: z.string().nullable(),
      muscle: z.string(),
      equipment: z.string().nullable(),
      logging_mode: modeSchema.optional(),
      load_convention: conventionSchema.optional(),
    }),
  ),
  sets: z.array(
    z
      .object({
        id: uuid,
        session_id: uuid,
        member_id: uuid,
        exercise_id: uuid,
        set_number: z.number().int().positive(),
        reps: nullableNumber,
        weight_kg: nullableNumber,
        rpe: nullableNumber,
        created_at: timestamp,
        sync: z.enum(["pending", "synced", "deleted"]),
        localRevision: z.number().int().nonnegative().optional(),
      })
      .extend(setDetailsSchema.partial().shape),
  ),
  plan: z.array(
    z.object({
      id: uuid,
      sets: z.number().int().nonnegative(),
      reps: z.string(),
      slot_key: z.string().max(100).optional(),
      program_version_id: uuid.optional(),
      exercise: z
        .object({
          id: uuid,
          name_en: z.string(),
          name_ar: z.string().nullable(),
          muscle: z.string(),
          equipment: z.string().nullable(),
          logging_mode: modeSchema.optional(),
          load_convention: conventionSchema.optional(),
        })
        .optional(),
    }),
  ),
  superset: z.array(uuid).max(2),
  supersetSlots: z.array(z.string().max(250)).max(2).optional(),
  editor: workoutEditorSchema.optional(),
  notes: z.string(),
  restEnd: z.number().finite(),
  phase: z.enum(["active", "finishing", "discarding"]),
  finishedAt: timestamp.nullable(),
  error: z.string().nullable(),
  holdStartedAt: z.number().nullable().optional(),
});
const envelope = z.object({
  app: z.literal("prime-fitness"),
  version: z.union([z.literal(1), z.literal(2)]),
  ownerId: uuid,
  projectHost: z.string().min(1),
  exportedAt: timestamp,
  storageUnits: z.literal("kg/cm"),
  data: record,
  media: z.array(
    z.object({
      path: z.string(),
      mime: z.string().refine(isImageMime, "Unsupported image MIME type"),
      base64: z.string(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
  workoutDraft: draftSchema,
  pendingMemberData: z.unknown().optional(),
});
export type PersonalBackup = z.infer<typeof envelope>;
export const projectHost = () => new URL(import.meta.env["VITE_SUPABASE_URL"]).host;
const pathOwned = (path: string, owner: string) =>
  path.startsWith(`${owner}/`) &&
  !path.includes("..") &&
  !path.includes("\\") &&
  !/[?#]/.test(path);
export function validateBackup(input: unknown, owner: string, host: string): PersonalBackup {
  const backup = envelope.parse(input);
  backup.data["wellness_checkins"] ??= [];
  if (backup.pendingMemberData != null) {
    const state = backup.pendingMemberData as MemberState;
    if (
      state.version !== 1 ||
      !Array.isArray(state.queue) ||
      state.queue.length > 100000 ||
      typeof state.records !== "object" ||
      state.records == null
    )
      throw new Error("Invalid pending member backup.");
    const ids = new Set<string>();
    for (const recovery of foodUndoEntries(state.references ?? {}))
      foodEntry(recovery.record, owner);
    for (const recovery of waterUndoEntries(state.references ?? {}))
      waterEntry(recovery.record, owner);
    for (const m of state.queue) {
      uuid.parse(m.id);
      uuid.parse(m.record_id);
      uuid.parse(m.group);
      if (
        !["queued", "sending", "conflict", "rejected"].includes(m.status) ||
        ![
          "food_logs",
          "water_logs",
          "body_measurements",
          "wellness_checkins",
          "saved_meals",
        ].includes(m.entity) ||
        !["put", "delete"].includes(m.op) ||
        m.payload?.member_id !== owner ||
        m.payload.id !== m.record_id ||
        !Number.isSafeInteger(m.base_revision) ||
        m.base_revision < 0 ||
        ids.has(m.id)
      )
        throw new Error("Invalid pending member ownership or mutation.");
      ids.add(m.id);
    }
    for (const rows of Object.values(state.records)) {
      if (!Array.isArray(rows) || rows.some((r) => r.member_id !== owner))
        throw new Error("Invalid cached member ownership.");
    }
  }
  if (backup.ownerId !== owner || backup.projectHost !== host)
    throw new Error("This backup belongs to a different account or project.");
  const profile = record.parse(backup.data["profile"]);
  if (
    profile["id"] !== owner ||
    !["metric", "imperial"].includes(String(profile["units"])) ||
    !["en", "ar"].includes(String(profile["locale"]))
  )
    throw new Error("Invalid profile in backup.");
  for (const tab of RESTORE_TABLES) {
    const rows = z.array(record).max(100000).parse(backup.data[tab]);
    const seen = new Set<string>();
    for (const row of rows) {
      const id = uuid.parse(row["id"]);
      if (row["member_id"] !== owner || seen.has(id))
        throw new Error("Invalid ownership or duplicate record in backup.");
      seen.add(id);
      for (const field of [
        "created_at",
        "started_at",
        "finished_at",
        "log_date",
        "measured_on",
        "taken_on",
      ])
        if (row[field] != null) timestamp.parse(row[field]);
      for (const field of [
        "reps",
        "weight_kg",
        "rpe",
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "ml",
        "waist_cm",
        "body_fat_pct",
      ])
        if (row[field] != null) z.number().finite().nonnegative().parse(row[field]);
      if (tab === "body_measurements")
        validateBodyValues(
          {
            weight_kg: (row["weight_kg"] as number | null) ?? null,
            waist_cm: (row["waist_cm"] as number | null) ?? null,
            body_fat_pct: (row["body_fat_pct"] as number | null) ?? null,
          },
          true,
        );
      if (
        tab === "water_logs" &&
        inputNumber(row["ml"] as number, {
          label: "Water",
          max: 10000,
          integer: true,
          exclusiveMin: true,
        }) == null
      )
        throw new Error("Invalid water entry in backup.");
      if (tab === "food_logs")
        for (const field of ["calories", "protein_g", "carbs_g", "fat_g"])
          inputNumber(row[field] as number, {
            label: field,
            max: 10000,
            integer: field === "calories",
          });
      if (tab === "wellness_checkins") {
        inputNumber(row["sleep_hours"] as number | null, { label: "Sleep", max: 24 });
        inputNumber(row["energy"] as number | null, {
          label: "Energy",
          min: 1,
          max: 5,
          integer: true,
        });
        inputNumber(row["soreness"] as number | null, {
          label: "Soreness",
          min: 1,
          max: 5,
          integer: true,
        });
        if (String(row["notes"] ?? "").length > 2000)
          throw new Error("Wellness notes exceed 2000 characters.");
      }
    }
  }
  const required = new Set(
    (backup.data["progress_photos"] as { path: string }[]).map((p) => z.string().parse(p["path"])),
  );
  if (profile["avatar_url"]) required.add(z.string().parse(profile["avatar_url"]));
  if (required.size !== backup.media.length)
    throw new Error("Backup photo files are incomplete or duplicated.");
  const seenMedia = new Set<string>();
  for (const media of backup.media) {
    if (!pathOwned(media.path, owner) || !required.has(media.path) || seenMedia.has(media.path))
      throw new Error("Invalid photo file in backup.");
    seenMedia.add(media.path);
  }
  if (
    backup.workoutDraft.userId !== owner ||
    (backup.workoutDraft.session && backup.workoutDraft.session.member_id !== owner) ||
    backup.workoutDraft.sets.some(
      (s) => s.member_id !== owner || s.session_id !== backup.workoutDraft.session?.id,
    )
  )
    throw new Error("Invalid pending workout ownership.");
  const sessions = new Set(
    (backup.data["workout_sessions"] as Record<string, unknown>[]).map((s) => String(s["id"])),
  );
  for (const tab of ["workout_exercises", "import_batches", "import_receipts"] as const) {
    const rows = z
      .array(record)
      .max(100000)
      .parse(backup.data[tab] ?? []);
    backup.data[tab] = rows;
    for (const row of rows) {
      if (row["member_id"] !== owner) throw new Error("Invalid backup provenance ownership.");
      if (tab !== "import_receipts") uuid.parse(row["id"]);
      if (tab === "workout_exercises") {
        uuid.parse(row["exercise_id"]);
        if (!sessions.has(String(row["session_id"])))
          throw new Error("A snapshot has no owned workout.");
        record.parse(row["snapshot"]);
      } else if (tab === "import_batches") {
        z.enum(["strong", "hevy", "fitnotes"]).parse(row["provider"]);
      } else {
        uuid.parse(row["batch_id"]);
        z.string()
          .regex(/^[a-f0-9]{32}$/)
          .parse(row["fingerprint"]);
        z.string()
          .regex(/^[a-f0-9]{32}$/)
          .parse(row["content_fingerprint"]);
        if (row["session_id"] != null && !sessions.has(String(row["session_id"])))
          throw new Error("An import receipt has no owned workout.");
      }
    }
  }
  validateBackupSets(backup.data["set_logs"] as BackupSet[], sessions);
  validateBackupSets(
    backup.workoutDraft.sets.filter((s) => s.sync !== "deleted") as BackupSet[],
    new Set(backup.workoutDraft.session ? [backup.workoutDraft.session.id] : []),
  );
  return backup;
}
type BackupSet = Parameters<typeof validateSetDetails>[0] & {
  id: string;
  member_id: string;
  session_id: string;
  exercise_id: string;
};
function validateBackupSets(sets: BackupSet[], sessions: Set<string>) {
  const byId = new Map<string, BackupSet>(),
    pairs = new Set<string>(),
    slots = new Map<string, string>();
  for (const row of sets) {
    uuid.parse(row.id);
    uuid.parse(row.session_id);
    uuid.parse(row.exercise_id);
    if (byId.has(row.id) || !sessions.has(row.session_id))
      throw new Error("A set has a duplicate ID or missing workout.");
    byId.set(row.id, row);
    const d = validateSetDetails(row);
    const slot = `${row.session_id}:${row.exercise_id}:${d.slot_key}`;
    const convention = `${d.logging_mode}:${d.load_convention}`;
    if (slots.has(slot) && slots.get(slot) !== convention)
      throw new Error("An exercise slot mixes measurement conventions.");
    slots.set(slot, convention);
    if (d.set_role === "working" && d.pair_id) {
      const key = `${slot}:${d.pair_id}:${d.side}`;
      if (pairs.has(key)) throw new Error("A unilateral working side is duplicated.");
      pairs.add(key);
    }
  }
  for (const row of sets) {
    const d = setDetailsSchema.parse(row);
    if (d.set_role !== "drop") continue;
    const root = byId.get(d.root_set_id!);
    if (
      !root ||
      root.id === row.id ||
      (root.set_role ?? "working") !== "working" ||
      root.member_id !== row.member_id ||
      root.session_id !== row.session_id ||
      root.exercise_id !== row.exercise_id ||
      (root.slot_key ?? "") !== d.slot_key ||
      (root.side ?? "bilateral") !== d.side
    )
      throw new Error("A drop segment has an invalid working-set parent.");
  }
}
const encode = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};
const decode = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export async function checksum(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function verifyMedia(backup: PersonalBackup) {
  let total = 0;
  for (const media of backup.media) {
    const bytes = decode(media.base64);
    total += bytes.length;
    if (
      bytes.length > 10 * 1024 * 1024 ||
      total > 90 * 1024 * 1024 ||
      (await checksum(bytes)) !== media.sha256
    )
      throw new Error("A photo is damaged or exceeds the backup size limit.");
  }
}
export async function createPersonalBackup(owner: string): Promise<PersonalBackup> {
  const workoutDraft = await readWorkout(owner);
  const result = await supabase.rpc("export_personal_data");
  if (result.error) throw result.error;
  const data = record.parse(result.data);
  const pending = new Set((await pendingPhotoDeletions(owner)).map((row) => row.photo_id));
  data["progress_photos"] = z
    .array(record)
    .parse(data["progress_photos"])
    .filter((row) => !pending.has(String(row["id"])));
  const photos = z.array(record).parse(data["progress_photos"]);
  const profile = record.parse(data["profile"]);
  const paths = new Set(photos.map((p) => z.string().parse(p["path"])));
  if (profile["avatar_url"]) paths.add(z.string().parse(profile["avatar_url"]));
  const media: PersonalBackup["media"] = [];
  let total = 0;
  for (const path of paths) {
    if (!pathOwned(path, owner)) throw new Error("A photo has an invalid storage path.");
    const file = await supabase.storage.from("progress-photos").download(path);
    if (file.error) throw new Error(`Photo download failed: ${file.error.message}`);
    total += file.data.size;
    if (total > 90 * 1024 * 1024)
      throw new Error("Backup exceeds 90 MB of photos. Export photos separately before retrying.");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    media.push({
      path,
      mime: z
        .string()
        .refine(isImageMime, "Stored photo has an unsupported MIME type")
        .parse(file.data.type.split(";")[0]!.trim().toLowerCase()),
      base64: encode(bytes),
      sha256: await checksum(bytes),
    });
  }
  const backup = validateBackup(
    {
      app: "prime-fitness",
      version: 2,
      ownerId: owner,
      projectHost: projectHost(),
      exportedAt: new Date().toISOString(),
      storageUnits: "kg/cm",
      data,
      media,
      workoutDraft,
      pendingMemberData: await readMemberState(owner),
    },
    owner,
    projectHost(),
  );
  await verifyMedia(backup);
  if (new Blob([JSON.stringify(backup)]).size > 128 * 1024 * 1024)
    throw new Error("Backup exceeds 128 MB. No partial backup was downloaded.");
  return backup;
}
export function downloadBackup(backup: PersonalBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `prime-fitness-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function restorePersonalBackup(
  input: PersonalBackup,
  owner: string,
  preferences: boolean,
) {
  const backup = validateBackup(input, owner, projectHost());
  if (backup.pendingMemberData) {
    const current = await readMemberState(owner),
      source = backup.pendingMemberData as MemberState;
    mergeFoodRecovery(
      current.references,
      source.references ?? {},
      owner,
      new Set(current.queue.filter((m) => m.entity === "food_logs").map((m) => m.record_id)),
    );
    mergeWaterRecovery(
      current.references,
      source.references ?? {},
      owner,
      new Set(current.queue.filter((m) => m.entity === "water_logs").map((m) => m.record_id)),
    );
  }
  await verifyMedia(backup);
  const added: string[] = [];
  const pending = new Set((await pendingPhotoDeletions(owner)).map((row) => row.path));
  if (backup.media.some((media) => pending.has(media.path)))
    throw new Error("Finish pending photo deletions before restoring this backup.");
  try {
    for (const media of backup.media) {
      const old = await supabase.storage.from("progress-photos").download(media.path);
      if (!old.error) {
        if ((await checksum(new Uint8Array(await old.data.arrayBuffer()))) !== media.sha256)
          throw new Error("An existing photo differs from the backup. Nothing was overwritten.");
        continue;
      }
      // The upload must fail on conflicts, including a concurrent restore.
      const up = await supabase.storage
        .from("progress-photos")
        .upload(media.path, new Blob([decode(media.base64)], { type: media.mime }), {
          upsert: false,
          contentType: media.mime,
        });
      if (up.error) throw up.error;
      added.push(media.path);
    }
    const data = Object.fromEntries(
      [...RESTORE_TABLES, "profile", "workout_exercises", "import_batches", "import_receipts"].map(
        (key) => [key, backup.data[key]],
      ),
    ) as Json;
    const result = await supabase.rpc("restore_personal_data", {
      _data: data,
      _preferences: preferences,
    });
    if (result.error) throw result.error;
  } catch (error) {
    // Never delete uploaded media on an ambiguous network failure: the server
    // transaction might have committed. Stable paths make a retry safe.
    throw new Error(
      `${error instanceof Error ? error.message : String((error as { message?: string }).message ?? error)}${added.length ? " Uploaded photos were retained; retry this backup to finish." : ""}`,
    );
  }
  let draft = "none";
  const source = backup.workoutDraft;
  if (source.session && source.phase !== "discarding") {
    const server = await supabase
      .from("workout_sessions")
      .select("finished_at")
      .eq("id", source.session.id)
      .eq("member_id", owner)
      .maybeSingle();
    if (server.error)
      throw new Error(
        "Personal records restored, but pending workout verification failed. Retry the backup.",
      );
    if (server.data?.finished_at) draft = "finished";
    else {
      await changeWorkout(owner, (current) => {
        if (current.session) {
          draft = "kept";
          return current;
        }
        draft = "restored";
        return {
          ...source,
          session: { ...source.session!, synced: false },
          sets: source.sets
            .filter((s) => s.sync !== "deleted")
            .map((s) => ({ ...s, sync: "pending" as const })),
          phase: "active",
          restEnd: 0,
          finishedAt: null,
          error: null,
        } satisfies Workout;
      }).catch(() => {
        throw new Error(
          "Personal records restored, but the pending workout could not be saved on this device. Retry the backup.",
        );
      });
    }
  }
  if (backup.pendingMemberData) {
    const source = backup.pendingMemberData as MemberState;
    await changeMemberState(owner, (current) => {
      const next = structuredClone(current);
      const protectedRecords = new Set(current.queue.map((m) => `${m.entity}:${m.record_id}`));
      const known = new Set(current.queue.map((m) => m.id));
      for (const mutation of source.queue) {
        if (
          known.has(mutation.id) ||
          protectedRecords.has(`${mutation.entity}:${mutation.record_id}`)
        )
          continue;
        next.queue.push({
          ...mutation,
          status: mutation.status === "sending" ? "queued" : mutation.status,
        });
      }
      for (const entity of [
        "food_logs",
        "water_logs",
        "body_measurements",
        "wellness_checkins",
        "saved_meals",
      ] as const) {
        const pendingIds = new Set(
          next.queue.filter((m) => m.entity === entity).map((m) => m.record_id),
        );
        const rows = source.records[entity] ?? [];
        next.records[entity] = [
          ...(current.records[entity] ?? []),
          ...rows.filter(
            (r) =>
              pendingIds.has(r.id) &&
              !protectedRecords.has(`${entity}:${r.id}`) &&
              !(current.records[entity] ?? []).some((old) => old.id === r.id),
          ),
        ];
      }
      next.references = mergeFoodRecovery(
        current.references,
        source.references ?? {},
        owner,
        new Set(current.queue.filter((m) => m.entity === "food_logs").map((m) => m.record_id)),
      );
      next.references = mergeWaterRecovery(
        next.references,
        source.references ?? {},
        owner,
        new Set(current.queue.filter((m) => m.entity === "water_logs").map((m) => m.record_id)),
      );
      return next;
    });
  }
  return draft;
}
