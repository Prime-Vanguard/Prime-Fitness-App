import { supabase } from "@/integrations/supabase/client";
import { changeWorkout, emptyWorkout, readWorkout } from "./workout-store";
import { setDetailsSchema } from "./training-model";
import { sameSetWrite } from "./workout-editor";
import { deviceScope } from "./device-scope";

const inFlight = new Map<string, Promise<void>>();
const timeout = () => AbortSignal.timeout(12000);

export function syncWorkout(userId: string): Promise<void> {
  const scope = deviceScope(userId);
  const existing = inFlight.get(scope);
  if (existing) return existing;
  const run = async () => {
    try {
      await flush(userId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : ((error as { message?: string }).message ??
            "Connection interrupted. Your workout is saved on this device.");
      await changeWorkout(userId, (w) => ({ ...w, error: message }));
    }
  };
  const promise = Promise.resolve(
    navigator.locks ? navigator.locks.request(`pf-workout-sync:${scope}`, run) : run(),
  )
    .then(() => {})
    .finally(() => inFlight.delete(scope));
  inFlight.set(scope, promise);
  return promise;
}

async function flush(userId: string) {
  if (!navigator.onLine) return;
  let w = await readWorkout(userId);
  const session = w.session;
  if (!session) return;
  const { data: auth } = await supabase.auth.getSession();
  if (auth.session?.user.id !== userId) return;
  const server = await supabase
    .from("workout_sessions")
    .select("id,finished_at")
    .eq("id", session.id)
    .eq("member_id", userId)
    .abortSignal(timeout())
    .maybeSingle();
  if (server.error) throw server.error;
  const clear = () =>
    changeWorkout(userId, (current) =>
      current.session?.id === session.id
        ? { ...emptyWorkout(userId), exercises: current.exercises }
        : current,
    );
  if (server.data?.finished_at) {
    if (w.phase === "discarding") {
      await clear();
      return;
    }
    if (w.phase === "finishing" && w.sets.every((s) => s.sync === "synced")) {
      await clear();
      return;
    }
    throw new Error(
      "This workout was finished on another device. Export your local copy before discarding it.",
    );
  }
  if (w.phase === "discarding") {
    if (server.data) {
      const sets = await supabase
        .from("set_logs")
        .delete()
        .eq("session_id", session.id)
        .eq("member_id", userId)
        .abortSignal(timeout());
      if (sets.error) throw sets.error;
      const result = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", session.id)
        .eq("member_id", userId)
        .is("finished_at", null)
        .abortSignal(timeout());
      if (result.error) throw result.error;
    }
    await clear();
    return;
  }
  if (!server.data) {
    if (session.occurrence_id) {
      const result = await supabase
        .rpc("start_session_occurrence", {
          _occurrence: session.occurrence_id,
          _session: session.id,
          _started: session.started_at,
        })
        .abortSignal(timeout());
      if (result.error) throw result.error;
      if ((result.data as { id?: string })?.id !== session.id)
        throw new Error(
          "This session was started on another device. Export your draft, then resume that session or convert this draft to a standalone workout.",
        );
    } else {
      const result = await supabase
        .from("workout_sessions")
        .upsert(
          {
            id: session.id,
            member_id: userId,
            title: session.title,
            started_at: session.started_at,
          },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .abortSignal(timeout());
      if (result.error) throw result.error;
    }
  }
  await changeWorkout(userId, (current) =>
    current.session?.id === session.id
      ? { ...current, session: { ...current.session, synced: true }, error: null }
      : current,
  );
  // Re-read after every acknowledgement so a deletion made while a request is
  // in flight survives that acknowledgement and is sent next.
  for (let i = 0; i < 2000; i++) {
    w = await readWorkout(userId);
    if (w.session?.id !== session.id || w.phase === "discarding") return;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== userId) return;
    const set = w.sets.find((s) => s.sync !== "synced");
    if (!set) break;
    if (set.sync === "deleted") {
      const result = await supabase
        .from("set_logs")
        .delete()
        .eq("id", set.id)
        .eq("member_id", userId)
        .abortSignal(timeout());
      if (result.error) throw result.error;
      await changeWorkout(userId, (current) => ({
        ...current,
        sets: current.sets.filter((s) => s.id !== set.id || !sameSetWrite(s, set)),
      }));
    } else {
      const { sync: _sync, localRevision: _revision, ...row } = set;
      const result = await supabase
        .from("set_logs")
        .upsert({ ...row, ...setDetailsSchema.parse(row) }, { onConflict: "id" })
        .select("id")
        .abortSignal(timeout());
      if (result.error) throw result.error;
      if (!result.data?.some((r) => r.id === set.id))
        throw new Error(
          "This set was not accepted. Sign in and retry; your device copy is retained.",
        );
      await changeWorkout(userId, (current) => ({
        ...current,
        sets: current.sets.map((s) => (sameSetWrite(s, set) ? { ...s, sync: "synced" } : s)),
      }));
    }
  }
  w = await readWorkout(userId);
  if (w.session?.id !== session.id) return;
  if (w.phase === "finishing" && w.sets.every((s) => s.sync === "synced")) {
    const result = await supabase
      .from("workout_sessions")
      .update({ notes: w.notes || null, finished_at: w.finishedAt })
      .eq("id", session.id)
      .eq("member_id", userId)
      .select("id")
      .abortSignal(timeout());
    if (result.error) throw result.error;
    if (!result.data.length)
      throw new Error("Workout was not accepted by the server. Sign in and retry.");
    await clear();
  }
}
