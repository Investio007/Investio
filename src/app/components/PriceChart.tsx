import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint, Period } from "../services/marketApi";

type PriceChartProps = {
  points: ChartPoint[];
  period: Period;
  height?: number;
  color?: string;
  compact?: boolean;
  loading?: boolean;
  approximate?: boolean;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0A1F44",
        color: "#fff",
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>{label}</div>
      <div>{payload[0]?.value?.toFixed(2)}</div>
    </div>
  );
}

export default function PriceChart({
  points,
  period,
  height = 90,
  color = "#007A4D",
  compact = false,
  loading = false,
  approximate = false,
}: PriceChartProps) {
  if (loading && points.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(10,31,68,0.45)",
          fontSize: 12,
        }}
      >
        Loading chart...
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(10,31,68,0.4)",
          fontSize: 11,
        }}
      >
        Chart unavailable
      </div>
    );
  }

  const firstClose = points[0]?.close;
  const lastClose = points[points.length - 1]?.close;
  const isPositive =
    lastClose !== undefined && firstClose !== undefined ? lastClose >= firstClose : true;
  const lineColor = isPositive ? color : "#E03A3E";

  return (
    <div>
      {approximate && (
        <p className="text-[10px] text-gray-400 mb-1 text-center">
          Approximate trend from live price
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          {!compact && (
            <XAxis
              dataKey="time"
              tick={{ fill: "rgba(10,31,68,0.45)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
          )}
          {!compact && (
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "rgba(10,31,68,0.45)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
          )}
          {!compact && <Tooltip content={<CustomTooltip />} />}
          <Line
            type="monotone"
            dataKey="close"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={compact ? false : { r: 4, fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
