"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ForecastRecord, TAIWAN_CITIES } from "@/types/weather";
import TemperatureCards from "./TemperatureCards";
import TemperatureChart from "./TemperatureChart";
import ForecastTable from "./ForecastTable";

export default function WeatherDashboard() {
  // 狀態管理
  const [selectedCity, setSelectedCity] = useState<string>("臺北市");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedIntervalKey, setSelectedIntervalKey] = useState<string>("");

  const [cityForecasts, setCityForecasts] = useState<ForecastRecord[]>([]);
  const [dateForecasts, setDateForecasts] = useState<ForecastRecord[]>([]);

  const [isLoadingCity, setIsLoadingCity] = useState<boolean>(true);
  const [isLoadingDate, setIsLoadingDate] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. 初始載入流程：先取得預設縣市資料 (臺北市)
  const fetchCityData = useCallback(async (city: string, isInitial = false) => {
    setIsLoadingCity(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `伺服器回應錯誤 (狀態碼: ${res.status})`);
      }

      const records: ForecastRecord[] = json.data || [];
      setCityForecasts(records);

      if (isInitial && records.length > 0) {
        // 設定預設日期與預設時段
        const firstRecord = records[0];
        const defaultDate = firstRecord.forecastDate;
        const defaultInterval = `${firstRecord.forecastStart}__${firstRecord.forecastEnd}`;

        setSelectedDate(defaultDate);
        setSelectedIntervalKey(defaultInterval);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || "無法載入縣市天氣資料");
    } finally {
      setIsLoadingCity(false);
    }
  }, []);

  // 2. 載入選定日期的全台預報資料
  const fetchDateData = useCallback(async (date: string) => {
    if (!date) return;
    setIsLoadingDate(true);
    try {
      const res = await fetch(`/api/weather?date=${encodeURIComponent(date)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `伺服器回應錯誤 (狀態碼: ${res.status})`);
      }

      setDateForecasts(json.data || []);
    } catch (err) {
      setErrorMsg((err as Error).message || "無法載入全台天氣資料");
    } finally {
      setIsLoadingDate(false);
    }
  }, []);

  // 第一次掛載時執行初始流程
  useEffect(() => {
    fetchCityData("臺北市", true);
  }, [fetchCityData]);

  // 當 selectedDate 變更時，抓取該日期的全台資料
  useEffect(() => {
    if (selectedDate) {
      fetchDateData(selectedDate);
    }
  }, [selectedDate, fetchDateData]);

  // 當使用者切換縣市時，抓取新縣市的多時段資料
  const handleCityChange = (newCity: string) => {
    setSelectedCity(newCity);
    fetchCityData(newCity, false);
  };

  // 從 cityForecasts 計算可用日期選單
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(cityForecasts.map((f) => f.forecastDate)));
    return dates;
  }, [cityForecasts]);

  // 計算可用時段選單
  const availableIntervals = useMemo(() => {
    const map = new Map<string, { key: string; label: string; start: string; end: string; date: string }>();
    cityForecasts.forEach((f) => {
      const key = `${f.forecastStart}__${f.forecastEnd}`;
      if (!map.has(key)) {
        // 格式化時段顯示標籤
        const formatTime = (ts: string) => {
          const [d, t] = ts.split(" ");
          const dp = d.split("-");
          const tp = t.split(":");
          return `${dp[1]}/${dp[2]} ${tp[0]}:${tp[1]}`;
        };
        map.set(key, {
          key,
          label: `${formatTime(f.forecastStart)} ~ ${formatTime(f.forecastEnd)}`,
          start: f.forecastStart,
          end: f.forecastEnd,
          date: f.forecastDate,
        });
      }
    });
    return Array.from(map.values());
  }, [cityForecasts]);

  // 當使用者選取時段時，自動同步對應的 date
  const handleIntervalChange = (newKey: string) => {
    setSelectedIntervalKey(newKey);
    const target = availableIntervals.find((i) => i.key === newKey);
    if (target && target.date !== selectedDate) {
      setSelectedDate(target.date);
    }
  };

  // 當使用者選取日期時，自動調整時段為該日期的第一個時段
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const matched = availableIntervals.find((i) => i.date === newDate);
    if (matched) {
      setSelectedIntervalKey(matched.key);
    }
  };

  // 取得目前選定縣市在選定時段下的即時紀錄
  const currentCityRecord = useMemo(() => {
    if (!selectedIntervalKey) return cityForecasts[0] || null;
    const [start, end] = selectedIntervalKey.split("__");
    return (
      cityForecasts.find((f) => f.forecastStart === start && f.forecastEnd === end) ||
      cityForecasts[0] ||
      null
    );
  }, [cityForecasts, selectedIntervalKey]);

  // 取得選定時段下的全台各縣市列表（過濾時段）
  const tableData = useMemo(() => {
    if (!selectedIntervalKey) return dateForecasts;
    const [start, end] = selectedIntervalKey.split("__");
    return dateForecasts.filter((f) => f.forecastStart === start && f.forecastEnd === end);
  }, [dateForecasts, selectedIntervalKey]);

  const currentIntervalLabel = useMemo(() => {
    const matched = availableIntervals.find((i) => i.key === selectedIntervalKey);
    return matched ? matched.label : selectedIntervalKey.replace("__", " ~ ");
  }, [availableIntervals, selectedIntervalKey]);

  return (
    <div className="space-y-8">
      {/* 錯誤警示卡片 */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold">載入天氣資料時發生問題</p>
            <p className="mt-1 text-xs opacity-90">{errorMsg}</p>
          </div>
          <button
            onClick={() => fetchCityData(selectedCity, true)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition"
          >
            重新嘗試
          </button>
        </div>
      )}

      {/* 頂部篩選控制台 (Selectors) */}
      <section className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. 縣市選擇器 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              📍 選擇縣市
            </label>
            <select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {TAIWAN_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 2. 日期選擇器 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              📅 選擇預報日期
            </label>
            <select
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={availableDates.length === 0}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* 3. 預報時段選擇器 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              ⏰ 選擇預報時段
            </label>
            <select
              value={selectedIntervalKey}
              onChange={(e) => handleIntervalChange(e.target.value)}
              disabled={availableIntervals.length === 0}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            >
              {availableIntervals.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 載入中骨架屏 */}
      {isLoadingCity && cityForecasts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="inline-block animate-spin text-3xl mb-3">🌀</div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            正在載入天氣預報資料...
          </p>
        </div>
      ) : (
        <>
          {/* 溫度指標卡片 */}
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                【{selectedCity}】當前選定時段摘要 ({currentIntervalLabel})
              </h2>
            </div>
            <TemperatureCards record={currentCityRecord} city={selectedCity} />
          </section>

          {/* 溫度趨勢折線圖 */}
          <section>
            <TemperatureChart data={cityForecasts} city={selectedCity} />
          </section>

          {/* 全台縣市預報總表 */}
          <section>
            {isLoadingDate ? (
              <div className="p-8 text-center text-slate-400">更新全台資料中...</div>
            ) : (
              <ForecastTable
                data={tableData}
                selectedCity={selectedCity}
                onSelectCity={handleCityChange}
                intervalLabel={currentIntervalLabel}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
