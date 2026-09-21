"use client";
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ForecastRecord } from "@/types/weather";

interface TemperatureChartProps {
  data: ForecastRecord[];
  city: string;
}

export default function TemperatureChart({ data, city }: TemperatureChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-400">
        暫無「{city}」之溫度趨勢圖表資料
      </div>
    );
  }

  // 格式化折線圖資料點
  const chartData = data.map((item) => {
    // 預報開始時間格式化：YYYY-MM-DD HH:mm:ss -> MM/DD HH:mm
    const parts = item.forecastStart.split(" ");
    const dateParts = parts[0]?.split("-") || [];
    const timeParts = parts[1]?.split(":") || [];
    const shortLabel = `${dateParts[1]}/${dateParts[2]} ${timeParts[0]}:${timeParts[1]}`;

    return {
      name: shortLabel,
      fullTime: `${item.forecastStart} ~ ${item.forecastEnd}`,
      minTemp: item.minTemp,
      maxTemp: item.maxTemp,
      avgTemp: item.avgTemp,
      weather: item.weatherDescription,
      rainProb: item.rainProbability,
    };
  });

  // 自動計算 Y 軸上下限
  const minVal = Math.min(...data.map((d) => d.minTemp));
  const maxVal = Math.max(...data.map((d) => d.maxTemp));
  const yMin = Math.floor(minVal - 2);
  const yMax = Math.ceil(maxVal + 2);

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60 gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>📈</span> {city} 36 小時氣溫變化趨勢
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            呈現各預報時段之最低與最高氣溫走勢
          </p>
        </div>
      </div>

      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, left: -15, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" opacity={0.6} />
            <XAxis
              dataKey="name"
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              unit="°C"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[200px]">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1">
                        時段：{p.fullTime}
                      </div>
                      <div className="flex justify-between items-center text-red-500 font-medium">
                        <span>最高溫：</span>
                        <span>{p.maxTemp} °C</span>
                      </div>
                      <div className="flex justify-between items-center text-blue-500 font-medium">
                        <span>最低溫：</span>
                        <span>{p.minTemp} °C</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-500 font-medium">
                        <span>平均溫：</span>
                        <span>{p.avgTemp} °C</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>天氣狀況：</span>
                        <span>{p.weather}</span>
                      </div>
                      {p.rainProb !== null && (
                        <div className="flex justify-between items-center text-indigo-500">
                          <span>降雨機率：</span>
                          <span>{p.rainProb}%</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: "10px", fontSize: "12px" }}
            />
            <Line
              type="monotone"
              dataKey="maxTemp"
              name="最高溫 (°C)"
              stroke="#f97316"
              strokeWidth={3}
              dot={{ r: 4, fill: "#f97316" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="minTemp"
              name="最低溫 (°C)"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4, fill: "#3b82f6" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
