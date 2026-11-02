import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import type { ProgressChartProps } from "./progress-line-chart";
export function DeferredProgressChart(props: ProgressChartProps) {
  const { locale } = useI18n(),
    ar = locale === "ar";
  const chart = useQuery({
    queryKey: ["progress-chart-module"],
    queryFn: () => import("./progress-line-chart"),
    staleTime: Infinity,
    retry: false,
  });
  if (chart.error)
    return (
      <p role="alert" className="mt-3 text-sm">
        {ar
          ? "تعذر تحميل الرسم؛ القيم متاحة في الجدول."
          : "Chart unavailable; values remain available in the table."}
        <Button variant="outline" onClick={() => void chart.refetch()}>
          {ar ? "إعادة تحميل الرسم" : "Retry chart"}
        </Button>
      </p>
    );
  if (!chart.data)
    return (
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        {ar ? "جارٍ تحميل الرسم…" : "Loading chart…"}
      </p>
    );
  return <chart.data.ProgressLineChart {...props} />;
}
