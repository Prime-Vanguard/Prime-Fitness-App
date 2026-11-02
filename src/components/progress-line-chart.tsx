import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";
export type ProgressChartProps = {
  series: { date: string; value: number }[];
  label: string;
  unit: string;
};
export function ProgressLineChart({ series, label, unit }: ProgressChartProps) {
  const { locale } = useI18n();
  const fmt = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Africa/Cairo",
    });
  return (
    <div className="mt-4 h-56" dir="ltr" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={fmt}
            stroke="var(--muted-foreground)"
            fontSize={12}
          />
          <YAxis
            domain={["auto", "auto"]}
            stroke="var(--muted-foreground)"
            fontSize={12}
            width={48}
          />
          <Tooltip
            labelFormatter={(value) => fmt(String(value))}
            formatter={(value) => [`${value} ${unit}`, label]}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--gold)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
