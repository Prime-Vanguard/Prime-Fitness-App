import { Link } from "@tanstack/react-router";
import { cardioState } from "@/features/cardio/store";
import { useI18n } from "@/lib/i18n";
import type { MemberState } from "@/lib/member-store";
import { profileSettingsStatus } from "@/lib/offline-profile-settings";
import { pendingCount, type Workout } from "@/lib/workout-store";

function readCardioQueue(state: MemberState) {
  try {
    return cardioState(state.references).queue;
  } catch {
    return null;
  }
}

export function OfflineSyncOverview({
  state,
  error,
  workout,
}: {
  state: MemberState;
  error: string;
  workout: Workout | null;
}) {
  const { locale } = useI18n();
  const label = (english: string, arabic: string) => (locale === "ar" ? arabic : english);
  const clear = label("Nothing waiting", "لا توجد تغييرات معلقة");
  const attention = label("Needs attention", "تحتاج معالجة");
  const unavailable = label("Device status unavailable", "حالة الجهاز غير متاحة");
  const waiting = (count: number) => label(`${count} waiting to sync`, `${count} بانتظار المزامنة`);
  const cardio = error ? null : readCardioQueue(state);
  const settings = profileSettingsStatus(state);
  const workoutStatus = !workout
    ? unavailable
    : workout.error
      ? attention
      : workout.session
        ? pendingCount(workout)
          ? waiting(pendingCount(workout))
          : label("Workout in progress", "تمرين جارٍ")
        : clear;
  const cardioStatus = !cardio
    ? unavailable
    : cardio.some((entry) => entry.status !== "queued")
      ? attention
      : cardio.length
        ? waiting(cardio.length)
        : clear;
  const settingsStatus = error
    ? unavailable
    : settings === "pending"
      ? label("Waiting to sync", "بانتظار المزامنة")
      : settings
        ? attention
        : clear;
  return (
    <ul className="space-y-2 text-sm" aria-label={label("Sync by activity", "المزامنة حسب النشاط")}>
      <li className="rounded-lg border p-3">
        <Link className="font-medium underline" to="/train">
          {label("Workout", "التمرين")}
        </Link>
        <p>{workoutStatus}</p>
      </li>
      <li className="rounded-lg border p-3">
        <Link className="font-medium underline" to="/progress" search={{ section: "cardio" }}>
          {label("Cardio", "تمارين القلب")}
        </Link>
        <p>{cardioStatus}</p>
      </li>
      <li className="rounded-lg border p-3">
        <Link className="font-medium underline" to="/profile" search={{ section: "preferences" }}>
          {label("Preferences", "التفضيلات")}
        </Link>
        <p>{settingsStatus}</p>
      </li>
    </ul>
  );
}
