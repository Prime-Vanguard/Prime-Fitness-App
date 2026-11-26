import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { celebrationMoves } from "@/lib/celebrate";
import { celebrationSound, haptic } from "@/lib/device-feedback";
import { embersFrom } from "@/lib/embers";
import { useI18n } from "@/lib/i18n";
import { numberLocale } from "@/lib/number-locale";

const STAMP_MS = 450;

/**
 * Plan item 3.5: a gold line joins the three quest checks, then a seal stamps over them
 * with the paid bonus, holds, and fades back to the list. Subtle and reduced motion fade
 * instead (no sparks); the caller skips it when celebrations are Off. Decorative only:
 * the quest status line below the list already announces the result.
 */
export function CampaignComplete({
  list,
  xp,
  onDone,
}: {
  list: RefObject<HTMLElement | null>;
  xp: number;
  onDone: () => void;
}) {
  const { locale } = useI18n();
  const seal = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState<{ top: number; height: number; start: number }>();
  const [leaving, setLeaving] = useState(false);

  // Join the first and last check icons, measured so it follows wrapping text and RTL.
  useLayoutEffect(() => {
    const box = list.current?.getBoundingClientRect();
    const checks = list.current?.querySelectorAll("[data-quest-check]");
    if (!box || !checks || checks.length < 2) return;
    const first = checks[0]!.getBoundingClientRect();
    const last = checks[checks.length - 1]!.getBoundingClientRect();
    const rtl = getComputedStyle(list.current!).direction === "rtl";
    setLink({
      top: first.top + first.height / 2 - box.top,
      height: last.top - first.top,
      start: rtl
        ? box.right - (first.left + first.width / 2)
        : first.left + first.width / 2 - box.left,
    });
  }, [list]);

  useEffect(() => {
    const moves = celebrationMoves();
    const timers = [
      window.setTimeout(
        () => {
          haptic("badge");
          void celebrationSound("chime");
          if (moves) embersFrom(seal.current, 28);
        },
        moves ? STAMP_MS + 250 : 0,
      ),
      window.setTimeout(() => setLeaving(true), moves ? 2600 : 1800),
      window.setTimeout(onDone, moves ? 2900 : 2100),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Plays once per mount; onDone only unmounts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden
      data-campaign-seal
      className={`pointer-events-none absolute inset-0 ${leaving ? "campaign-out" : ""}`}
    >
      {link && (
        <span
          className="campaign-link absolute w-0.5 rounded-full bg-gold"
          style={{ top: link.top, height: link.height, insetInlineStart: link.start - 1 }}
        />
      )}
      <div className="absolute inset-0 grid place-items-center">
        <div className="-rotate-6">
          <div
            ref={seal}
            className="campaign-seal grid size-32 place-items-center rounded-full border-4 border-double border-gold bg-card p-3 text-center text-gold shadow-[0_0_24px_rgb(212_175_55/0.35)]"
          >
            <div>
              <p className="font-heading text-sm font-bold leading-tight">
                {locale === "ar" ? "اكتملت حملة الأسبوع" : "Campaign complete"}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums">
                <bdi dir="ltr">+{xp.toLocaleString(numberLocale(locale))} XP</bdi>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
