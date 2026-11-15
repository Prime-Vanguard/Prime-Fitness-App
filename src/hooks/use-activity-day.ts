import { useEffect, useState } from "react";
import { activityDay } from "@/lib/dates";
// Refresh the Cairo activity date while the app remains open or regains focus.
export function useActivityDay() {
  const [day, setDay] = useState(() => activityDay());
  useEffect(() => {
    const tick = () => setDay(activityDay());
    const timer = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return day;
}
