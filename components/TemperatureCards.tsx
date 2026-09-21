"useContent";
import React from "react";
import { ForecastRecord } from "@/types/weather";

interface TemperatureCardsProps {
  record: ForecastRecord | null;
  city: string;
}

export default function TemperatureCards({ record, city }: TemperatureCardsProps) {
  if (!record) {
    return (
      <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 shadow-sm text-center text-slate-500">
        目前無「{city}」於選定時段的詳細資料
      </div>
    );
  }

  // 根據平均溫度計算背景/標籤色彩風格
  const getTempColorClass = (temp: number) => {
    if (temp < 20) return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800";
    if (temp < 25) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800";
    if (temp < 30) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800";
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800";
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* 最低溫 */}
      <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            最低溫
          </span>
          <span className="text-blue-500 text-lg">❄️</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {record.minTemp}
          </span>
          <span className="text-slate-500 text-sm font-medium">°C</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          {city} 預期低溫
        </p>
      </div>

      {/* 最高溫 */}
      <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            最高溫
          </span>
          <span className="text-orange-500 text-lg">🔥</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {record.maxTemp}
          </span>
          <span className="text-slate-500 text-sm font-medium">°C</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          {city} 預期高溫
        </p>
      </div>

      {/* 平均溫 */}
      <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            平均溫
          </span>
          <span className="text-emerald-500 text-lg">🌡️</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {record.avgTemp}
          </span>
          <span className="text-slate-500 text-sm font-medium">°C</span>
        </div>
        <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full border ${getTempColorClass(record.avgTemp)}`}>
          {record.avgTemp >= 30 ? "偏熱" : record.avgTemp >= 25 ? "溫暖" : record.avgTemp >= 20 ? "舒適" : "偏涼"}
        </span>
      </div>

      {/* 天氣現象 */}
      <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            天氣現象
          </span>
          <span className="text-cyan-500 text-lg">🌤️</span>
        </div>
        <div className="text-lg font-bold text-slate-900 dark:text-white truncate" title={record.weatherDescription}>
          {record.weatherDescription || "正常"}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 truncate">
          {record.forecastStart.split(" ")[1]?.slice(0, 5)} ~ {record.forecastEnd.split(" ")[1]?.slice(0, 5)}
        </p>
      </div>

      {/* 降雨機率 */}
      <div className="col-span-2 md:col-span-1 p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            降雨機率
          </span>
          <span className="text-indigo-500 text-lg">💧</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {record.rainProbability !== null ? record.rainProbability : "--"}
          </span>
          <span className="text-slate-500 text-sm font-medium">%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-3 overflow-hidden">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, record.rainProbability ?? 0))}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
