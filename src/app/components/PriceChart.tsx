import { useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChart } from "../hooks/useMarketData";
import type { Period } from "../services/marketApi";

interface PriceChartProps {
  symbol: string;
  initialPeriod?: Period;
  showPeriodSelector?: boolean;
  height?: number;
  color?: string;
  compact?: boolean;
  fallbackData?: Array<{ time: string; close: number }>;
  fallbackDataByPeriod?: Partial<Record<Period, Array<{ time: string; close: number }>>>;
}

const PERIODS: Period[] = ["1D", "1W", "1M", "6M", "1Y"];

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
  symbol,
  initialPeriod = "1W",
  showPeriodSelector = true,
  height = 90,
  color = "#007A4D",
  compact = false,
  fallbackData = [],
  fallbackDataByPeriod,
}: PriceChartProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const { data, loading, error } = useChart(symbol, period);

  const chartData = data?.data ?? [];
  const periodFallbackData = fallbackDataByPeriod?.[period] ?? fallbackData;
  const effectiveData = chartData.length > 0 ? chartData : periodFallbackData;
  const firstClose = effectiveData[0]?.close;
  const lastClose = effectiveData[effectiveData.length - 1]?.close;
  const isPositive =
    lastClose !== undefined && firstClose !== undefined ? lastClose >= firstClose : true;
  const lineColor = isPositive ? color : "#E03A3E";

  if (loading && effectiveData.length === 0) {
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

  if ((error && effectiveData.length === 0) || effectiveData.length === 0) {
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

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={effectiveData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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

      {showPeriodSelector && (
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {PERIODS.map((periodValue) => (
            <button
              key={periodValue}
              onClick={() => setPeriod(periodValue)}
              className={`period-btn${period === periodValue ? " active" : ""}`}
            >
              {periodValue}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
