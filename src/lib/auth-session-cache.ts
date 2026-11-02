import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

/** Synchronous boundary: clear before navigation; cancelled requests cannot refill old caches. */
export function sessionCacheBoundary(client: QueryClient, resetView: () => void) {
  let identity: string | null | undefined;
  return (event: AuthChangeEvent, session: Session | null) => {
    const next = session?.user.id ?? null;
    const changed = identity !== undefined && identity !== next;
    const reset =
      event === "SIGNED_OUT" || changed || (event === "SIGNED_IN" && identity === undefined);
    if (reset) {
      void client.cancelQueries();
      client.clear();
      resetView();
    }
    identity = next;
    if (event === "SIGNED_IN" || event === "USER_UPDATED") void client.invalidateQueries();
    return reset;
  };
}
