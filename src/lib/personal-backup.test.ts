import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), storage: { from: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import { emptyWorkout } from "./workout-store";
import { readMemberState } from "./member-store";
import type { PersonalBackup } from "./personal-backup";
import {
  checksum,
  createPersonalBackup,
  RESTORE_TABLES,
  validateBackup,
  verifyMedia,
  restorePersonalBackup,
} from "./personal-backup";
const owner = "00000000-0000-4000-8000-000000000101";
const other = "00000000-0000-4000-8000-000000000102";
function sample(): PersonalBackup {
  return {
    app: "prime-fitness",
    version: 1,
    ownerId: owner,
    projectHost: "test.supabase.co",
    exportedAt: new Date().toISOString(),
    storageUnits: "kg/cm",
    data: {
      ...Object.fromEntries(RESTORE_TABLES.map((t) => [t, []])),
      profile: { id: owner, units: "metric", locale: "en", avatar_url: null },
    },
    media: [],
    workoutDraft: emptyWorkout(owner),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function pendingRows(rows: { photo_id: string; path: string }[] = []) {
  const range = vi
    .fn()
    .mockResolvedValueOnce({ data: rows, error: null })
    .mockResolvedValue({ data: [], error: null });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range,
  };
  vi.mocked(supabase.from).mockReturnValue(query as never);
}
describe("portable personal backups", () => {
  it("validates and restores deleted-food recovery with member ownership intact", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    pendingRows();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: {}, error: null } as never);
    const target = crypto.randomUUID(),
      input = sample();
    input.version = 2;
    input.ownerId = target;
    input.data["profile"] = { id: target, units: "metric", locale: "en", avatar_url: null };
    input.workoutDraft = emptyWorkout(target);
    const recovery = {
      token: crypto.randomUUID(),
      mode: "online",
      status: "deleted",
      record: {
        id: crypto.randomUUID(),
        member_id: target,
        log_date: "2026-10-20",
        meal: "breakfast",
        name: "Oats",
        calories: 200,
        protein_g: 10,
        carbs_g: 30,
        fat_g: 5,
        revision: 1,
      },
    };
    const waterRecovery = {
      token: crypto.randomUUID(),
      mode: "queued",
      status: "deleted",
      record: {
        id: crypto.randomUUID(),
        member_id: target,
        log_date: "2026-10-20",
        ml: 750,
        revision: 2,
      },
    };
    input.pendingMemberData = {
      version: 1,
      queue: [],
      records: {},
      references: { nutritionUndo: [recovery], waterUndo: [waterRecovery], targets: "stale" },
    };
    await restorePersonalBackup(input, target, false);
    expect((await readMemberState(target)).references).toEqual({
      nutritionUndo: [recovery],
      waterUndo: [waterRecovery],
    });
    waterRecovery.record.member_id = owner;
    expect(() => validateBackup(input, target, "test.supabase.co")).toThrow();
    waterRecovery.record.member_id = target;
    recovery.record.member_id = owner;
    expect(() => validateBackup(input, target, "test.supabase.co")).toThrow();
  });
  it("retains pending planned rows, selection, and slot supersets in portable backups", () => {
    const backup = sample(),
      exercise = crypto.randomUUID(),
      row = crypto.randomUUID();
    backup.workoutDraft.editor = {
      selectedSlot: "local:first",
      selectedExercise: exercise,
      drafts: { first: { reps: "8", weight: "50", rpe: "", units: "metric" } },
      plannedRows: {
        first: [
          {
            id: row,
            number: 2,
            revision: 3,
            draft: { reps: "10", weight: "55", rpe: "7", units: "metric" },
          },
        ],
      },
    };
    backup.workoutDraft.supersetSlots = [
      JSON.stringify([exercise, "local:first"]),
      JSON.stringify([exercise, "local:second"]),
    ];
    const checked = validateBackup(backup, owner, "test.supabase.co");
    expect(checked.workoutDraft.editor).toEqual(backup.workoutDraft.editor);
    expect(checked.workoutDraft.supersetSlots).toEqual(backup.workoutDraft.supersetSlots);
  });
  it("forwards owned import provenance and exercise snapshots to the restore operation", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    pendingRows();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: {}, error: null } as never);
    const input = sample(),
      session = crypto.randomUUID(),
      batch = crypto.randomUUID();
    input.data["workout_sessions"] = [
      { id: session, member_id: owner, origin: "import", import_batch_id: batch },
    ];
    input.data["import_batches"] = [
      { id: batch, member_id: owner, provider: "strong", parser_version: 1 },
    ];
    input.data["workout_exercises"] = [
      {
        id: crypto.randomUUID(),
        member_id: owner,
        session_id: session,
        exercise_id: other,
        snapshot: { name_en: "Original squat" },
      },
    ];
    input.data["import_receipts"] = [
      {
        member_id: owner,
        provider: "strong",
        batch_id: batch,
        session_id: session,
        fingerprint: "a".repeat(32),
        content_fingerprint: "b".repeat(32),
      },
    ];
    await restorePersonalBackup(input, owner, false);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "restore_personal_data",
      expect.objectContaining({
        _data: expect.objectContaining({
          import_batches: input.data["import_batches"],
          workout_exercises: input.data["workout_exercises"],
          import_receipts: input.data["import_receipts"],
        }),
      }),
    );
  });
  it("preserves program-slot and timed-exercise metadata in restored drafts", () => {
    const input = sample();
    input.workoutDraft.plan = [
      {
        id: other,
        slot_key: `${other}:${owner}`,
        program_version_id: other,
        sets: 3,
        reps: "30s",
        exercise: {
          id: other,
          name_en: "Hold",
          name_ar: null,
          muscle: "core",
          equipment: null,
          logging_mode: "timed",
          load_convention: "bodyweight",
        },
      },
    ];
    const restored = validateBackup(input, owner, "test.supabase.co");
    expect(restored.workoutDraft.plan).toEqual(input.workoutDraft.plan);
  });
  it.each(["orphan", "self", "mixed-mode", "duplicate-side"])(
    "rejects %s set graphs before restoration",
    (kind) => {
      const input = sample(),
        session = crypto.randomUUID(),
        exercise = crypto.randomUUID(),
        root = crypto.randomUUID(),
        child = crypto.randomUUID();
      input.data["workout_sessions"] = [{ id: session, member_id: owner }];
      const first = {
        id: root,
        member_id: owner,
        session_id: session,
        exercise_id: exercise,
        reps: 8,
        weight_kg: 20,
        rpe: 7,
      };
      let second: Record<string, unknown> = {
        ...first,
        id: child,
        set_role: "drop",
        root_set_id: kind === "self" ? child : crypto.randomUUID(),
        segment_index: 1,
      };
      if (kind === "mixed-mode")
        second = { ...first, id: child, logging_mode: "timed", reps: null, duration_seconds: 30 };
      if (kind === "duplicate-side") {
        Object.assign(first, { side: "left", pair_id: owner });
        second = { ...first, id: child };
      }
      input.data["set_logs"] = [first, second];
      expect(() => validateBackup(input, owner, "test.supabase.co")).toThrow();
      expect(supabase.rpc).not.toHaveBeenCalled();
    },
  );
  it("accepts a valid working/drop graph with legacy weighted-set defaults", () => {
    const input = sample(),
      session = crypto.randomUUID(),
      exercise = crypto.randomUUID(),
      root = crypto.randomUUID();
    input.data["workout_sessions"] = [{ id: session, member_id: owner }];
    const first = {
      id: root,
      member_id: owner,
      session_id: session,
      exercise_id: exercise,
      reps: 8,
      weight_kg: 20,
      rpe: 7,
    };
    input.data["set_logs"] = [
      first,
      {
        ...first,
        id: crypto.randomUUID(),
        weight_kg: 10,
        set_role: "drop",
        root_set_id: root,
        segment_index: 1,
      },
    ];
    expect(() => validateBackup(input, owner, "test.supabase.co")).not.toThrow();
  });
  it.each([
    ["body_measurements", { weight_kg: 0 }],
    ["body_measurements", { body_fat_pct: 101 }],
    ["water_logs", { ml: 0 }],
    ["food_logs", { protein_g: 10001 }],
  ])("rejects invalid numeric data in %s before any network writes", (table, fields) => {
    const input = sample();
    input.data[String(table)] = [{ id: other, member_id: owner, ...(fields as object) }];
    expect(() => validateBackup(input, owner, "test.supabase.co")).toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it("preserves zero body fat and nullable legacy body fields", () => {
    const input = sample();
    input.data["body_measurements"] = [
      { id: other, member_id: owner, weight_kg: null, waist_cm: null, body_fat_pct: 0 },
    ];
    expect(validateBackup(input, owner, "test.supabase.co").data["body_measurements"]).toEqual(
      input.data["body_measurements"],
    );
  });
  it("round trips a valid empty account", () => {
    const input = sample();
    expect(
      validateBackup(JSON.parse(JSON.stringify(input)), owner, "test.supabase.co").ownerId,
    ).toBe(owner);
  });
  it("rejects wrong account, wrong project and unsupported formats", () => {
    expect(() => validateBackup(sample(), other, "test.supabase.co")).toThrow("different account");
    expect(() => validateBackup(sample(), owner, "other.supabase.co")).toThrow("different account");
    expect(() => validateBackup({ ...sample(), version: 3 }, owner, "test.supabase.co")).toThrow();
  });
  it("rejects foreign rows and duplicate IDs before any network writes", () => {
    const input = sample();
    input.data["food_logs"] = [{ id: other, member_id: other }];
    expect(() => validateBackup(input, owner, "test.supabase.co")).toThrow("ownership");
    input.data["food_logs"] = [
      { id: other, member_id: owner },
      { id: other, member_id: owner },
    ];
    expect(() => validateBackup(input, owner, "test.supabase.co")).toThrow("duplicate");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it("rejects missing photo binaries and corrupt checksums", async () => {
    const input = sample();
    input.data["progress_photos"] = [{ id: other, member_id: owner, path: `${owner}/photo.jpg` }];
    expect(() => validateBackup(input, owner, "test.supabase.co")).toThrow("incomplete");
    const valid = validateBackup(sample(), owner, "test.supabase.co");
    valid.media.push({
      path: `${owner}/photo.jpg`,
      mime: "image/jpeg",
      base64: btoa("photo"),
      sha256: "0".repeat(64),
    });
    vi.stubGlobal("crypto", webcrypto);
    await expect(verifyMedia(valid)).rejects.toThrow("damaged");
    expect(await checksum(new TextEncoder().encode("photo"))).toHaveLength(64);
    vi.unstubAllGlobals();
  });
  it("stops export on a database error without attempting media downloads", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: "Export failed" },
    } as never);
    await expect(createPersonalBackup(owner)).rejects.toMatchObject({ message: "Export failed" });
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });
  it("exports and restores legacy image bytes without rejecting GIF MIME", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubGlobal("crypto", webcrypto);
    const input = sample();
    const path = `${owner}/legacy.gif`;
    const bytes = new TextEncoder().encode("GIF89a-legacy-bytes");
    input.data["progress_photos"] = [{ id: other, member_id: owner, path }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: input.data, error: null } as never);
    pendingRows();
    const download = vi.fn().mockResolvedValue({
      data: {
        size: bytes.length,
        type: "image/gif; charset=binary",
        arrayBuffer: async () => bytes.buffer,
      },
      error: null,
    });
    vi.mocked(supabase.storage.from).mockReturnValue({ download } as never);
    const backup = await createPersonalBackup(owner);
    expect(backup.media[0]?.mime).toBe("image/gif");
    expect(atob(backup.media[0]!.base64)).toBe("GIF89a-legacy-bytes");
    await verifyMedia(backup);
    pendingRows();
    await expect(restorePersonalBackup(backup, owner, false)).resolves.toBe("none");
  });
  it("excludes queued deletions from exports and does not download their files", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubGlobal("crypto", webcrypto);
    const input = sample();
    const path = `${owner}/removed.jpg`;
    input.data["progress_photos"] = [{ id: other, member_id: owner, path }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: input.data, error: null } as never);
    pendingRows([{ photo_id: other, path }]);
    const backup = await createPersonalBackup(owner);
    expect(backup.data["progress_photos"]).toEqual([]);
    expect(backup.media).toEqual([]);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });
  it("rejects restoring media while its deletion is pending, before any writes", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubGlobal("crypto", webcrypto);
    const input = sample();
    const path = `${owner}/removed.jpg`;
    const bytes = new TextEncoder().encode("photo");
    input.data["progress_photos"] = [{ id: other, member_id: owner, path }];
    input.media = [
      { path, mime: "image/jpeg", base64: btoa("photo"), sha256: await checksum(bytes) },
    ];
    pendingRows([{ photo_id: other, path }]);
    await expect(restorePersonalBackup(input, owner, false)).rejects.toThrow(
      "pending photo deletions",
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });
});
