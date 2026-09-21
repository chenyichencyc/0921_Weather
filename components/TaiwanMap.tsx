"use client";
import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ForecastRecord } from "@/types/weather";
import { normalizeCityName, getTemperatureColor } from "@/lib/cityNames";

interface CountyProperties {
  COUNTYNAME?: string;
  COUNTYSN?: string;
  name?: string;
  [key: string]: unknown;
}

interface TaiwanMapProps {
  weatherData: ForecastRecord[];
  selectedCity: string;
  onSelectCity: (city: string) => void;
  intervalLabel: string;
}

export default function TaiwanMap({
  weatherData,
  selectedCity,
  onSelectCity,
  intervalLabel,
}: TaiwanMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection<Geometry, CountyProperties> | null>(null);
  const [isLoadingGeo, setIsLoadingGeo] = useState<boolean>(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  // 1. 載入本地台灣縣市 GeoJSON
  useEffect(() => {
    let isMounted = true;
    async function loadGeoJson() {
      try {
        const res = await fetch("/data/taiwan-cities.geojson");
        if (!res.ok) {
          throw new Error(`無法載入台灣縣市 GeoJSON (HTTP ${res.status})`);
        }
        const data: FeatureCollection<Geometry, CountyProperties> = await res.json();
        if (isMounted) {
          setGeoData(data);
          setIsLoadingGeo(false);
        }
      } catch (err) {
        if (isMounted) {
          setGeoError((err as Error).message || "GeoJSON 載入失敗");
          setIsLoadingGeo(false);
        }
      }
    }
    loadGeoJson();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. 建立城市名稱到天氣紀錄的 Map (以標準名稱為 Key)
  const weatherMap = useMemo(() => {
    const map = new Map<string, ForecastRecord>();
    weatherData.forEach((rec) => {
      const normalized = normalizeCityName(rec.city);
      map.set(normalized, rec);
    });
    return map;
  }, [weatherData]);

  // 3. 設定縣市多邊形樣式
  const styleFeature = (feature: Feature<Geometry, CountyProperties> | undefined): PathOptions => {
    if (!feature || !feature.properties) {
      return {
        fillColor: "#94a3b8",
        weight: 1.5,
        opacity: 1,
        color: "#ffffff",
        fillOpacity: 0.7,
      };
    }

    const rawName = String(feature.properties.COUNTYNAME || feature.properties.name || "");
    const cityName = normalizeCityName(rawName);
    const weather = weatherMap.get(cityName);
    const isSelected = cityName === selectedCity;

    const fillColor = getTemperatureColor(weather?.avgTemp);

    return {
      fillColor: fillColor,
      weight: isSelected ? 3 : 1.5,
      opacity: 1,
      color: isSelected ? "#1e293b" : "#ffffff",
      fillOpacity: isSelected ? 0.95 : 0.75,
    };
  };

  // 4. 綁定事件與 Popup / Tooltip
  const onEachFeature = (feature: Feature<Geometry, CountyProperties>, layer: Layer) => {
    if (!feature.properties) return;

    const rawName = String(feature.properties.COUNTYNAME || feature.properties.name || "");
    const cityName = normalizeCityName(rawName);
    const weather = weatherMap.get(cityName);

    // Hover Tooltip: 顯示縣市名稱與平均溫
    const avgText = weather?.avgTemp !== undefined ? `${weather.avgTemp}°C` : "無資料";
    const wxText = weather?.weatherDescription ? ` · ${weather.weatherDescription}` : "";
    layer.bindTooltip(
      `<strong>${cityName}</strong>: ${avgText}${wxText}`,
      { sticky: true, direction: "top", className: "custom-leaflet-tooltip" }
    );

    // Click Popup: 顯示完整預報資訊
    const minText = weather?.minTemp !== undefined ? `${weather.minTemp}°C` : "--";
    const maxText = weather?.maxTemp !== undefined ? `${weather.maxTemp}°C` : "--";
    const rainText = weather?.rainProbability !== null && weather?.rainProbability !== undefined ? `${weather.rainProbability}%` : "--";
    const timeText = weather ? `${weather.forecastStart} ~ ${weather.forecastEnd}` : "無資料";

    const popupContent = `
      <div style="font-family: system-ui, sans-serif; min-width: 180px; padding: 4px;">
        <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          📍 ${cityName}
        </h4>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
          時段: ${timeText}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
          <span>平均溫:</span>
          <strong style="color: #0f172a;">${avgText}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; color: #ef4444;">
          <span>最高溫:</span>
          <strong>${maxText}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; color: #3b82f6;">
          <span>最低溫:</span>
          <strong>${minText}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; color: #6366f1;">
          <span>降雨機率:</span>
          <strong>${rainText}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0;">
          <span>天氣現象:</span>
          <span style="font-weight: 500;">${weather?.weatherDescription || "無"}</span>
        </div>
      </div>
    `;

    layer.bindPopup(popupContent);

    // 點擊事件：切換選取縣市
    layer.on({
      click: () => {
        onSelectCity(cityName);
      },
      mouseover: (e: LeafletMouseEvent) => {
        const target = e.target;
        target.setStyle({
          weight: 3,
          color: "#0284c7",
          fillOpacity: 0.9,
        });
      },
      mouseout: (e: LeafletMouseEvent) => {
        const isSelected = cityName === selectedCity;
        e.target.setStyle({
          weight: isSelected ? 3 : 1.5,
          color: isSelected ? "#1e293b" : "#ffffff",
          fillOpacity: isSelected ? 0.95 : 0.75,
        });
      },
    });
  };

  if (isLoadingGeo) {
    return (
      <div className="h-96 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="animate-spin text-lg">🌀</span> 載入台灣 GIS 地圖圖資中...
        </div>
      </div>
    );
  }

  if (geoError || !geoData) {
    return (
      <div className="h-96 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-6 flex items-center justify-center text-red-600 text-sm">
        ⚠️ 地圖圖資載入失敗：{geoError || "未知錯誤"}
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60 gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🗺️</span> 台灣縣市氣溫 GIS 互動地圖
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            依據預報時段【{intervalLabel}】平均氣溫填色 · 點擊縣市可連動儀表板
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>目前選定：</span>
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold rounded-md">
            {selectedCity}
          </span>
        </div>
      </div>

      {/* 地圖容器 */}
      <div className="w-full h-[450px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative z-0">
        <MapContainer
          center={[23.7, 120.95]}
          zoom={7.2}
          minZoom={6}
          maxZoom={12}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Key 加入 selectedCity 與 weatherData 筆數以確保資料切換時重新渲染樣式 */}
          <GeoJSON
            key={`${selectedCity}-${weatherData.length}-${weatherData[0]?.sourceUpdatedAt || ""}-${intervalLabel}`}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        </MapContainer>

        {/* 溫度圖例 (Legend) */}
        <div className="absolute bottom-4 right-4 z-[400] p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 pointer-events-auto">
          <div className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1">
            <span>🌡️</span> 平均氣溫圖例
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-[#ef4444] shadow-sm"></span>
              <span>≥ 30°C (炎熱)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-[#f59e0b] shadow-sm"></span>
              <span>25–29.9°C (溫暖)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-[#10b981] shadow-sm"></span>
              <span>20–24.9°C (舒適)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-[#3b82f6] shadow-sm"></span>
              <span>&lt; 20°C (偏涼)</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-400">
              <span className="w-3.5 h-3.5 rounded-md bg-[#94a3b8] shadow-sm"></span>
              <span>無資料</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
