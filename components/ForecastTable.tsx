"use client";
import React from "react";
import { ForecastRecord } from "@/types/weather";

interface ForecastTableProps {
  data: ForecastRecord[];
  selectedCity: string;
  onSelectCity?: (city: string) => void;
  intervalLabel: string;
}

export default function ForecastTable({
  data,
  selectedCity,
  onSelectCity,
  intervalLabel,
}: ForecastTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center text-slate-400">
        目前無選定日期與時段之全台縣市資料
      </div>
    );
  }

  // 根據縣市名稱排序
  const sortedData = [...data].sort((a, b) => a.city.localeCompare(b.city, "zh-Hant"));

  const getAvgTempBadge = (temp: number) => {
    if (temp >= 30) {
      return <span className="px-2 py-0.5 text-xs font-semibold text-red-700 bg-red-100 dark:bg-red-950/60 dark:text-red-300 rounded-md">{temp}°C (偏熱)</span>;
    }
    if (temp >= 25) {
      return <span className="px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 rounded-md">{temp}°C (溫暖)</span>;
    }
    if (temp >= 20) {
      return <span className="px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-md">{temp}°C (舒適)</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 rounded-md">{temp}°C (偏涼)</span>;
  };

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60 gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>📋</span> 全台縣市天氣預報總表
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            時段：{intervalLabel}（共 {sortedData.length} 個縣市）
          </p>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          💡 點擊列可切換選定縣市
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3 rounded-l-lg font-semibold">縣市</th>
              <th scope="col" className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">最低溫</th>
              <th scope="col" className="px-4 py-3 font-semibold text-orange-600 dark:text-orange-400">最高溫</th>
              <th scope="col" className="px-4 py-3 font-semibold">平均溫</th>
              <th scope="col" className="px-4 py-3 font-semibold">天氣現象</th>
              <th scope="col" className="px-4 py-3 rounded-r-lg font-semibold text-indigo-600 dark:text-indigo-400">降雨機率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {sortedData.map((row) => {
              const isSelected = row.city === selectedCity;
              return (
                <tr
                  key={row.id || `${row.city}-${row.forecastStart}`}
                  onClick={() => onSelectCity && onSelectCity(row.city)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 font-semibold"
                      : "hover:bg-slate-50/60 dark:hover:bg-slate-700/40"
                  }`}
                >
                  <td className="px-4 py-3 flex items-center gap-2">
                    {isSelected && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                    <span className={isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-slate-200"}>
                      {row.city}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {row.minTemp} °C
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {row.maxTemp} °C
                  </td>
                  <td className="px-4 py-3">
                    {getAvgTempBadge(row.avgTemp)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {row.weatherDescription}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {row.rainProbability !== null ? `${row.rainProbability}%` : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
