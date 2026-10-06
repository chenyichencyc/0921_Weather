import { NextRequest, NextResponse } from "next/server";
import {
  getForecastsByDate,
  getForecastsByCity,
  upsertForecastRecords,
} from "@/lib/database";
import { fetchCwaForecasts, ParsedCwaRecord } from "@/lib/cwa";
import { ForecastRecord, WeatherApiResponse } from "@/types/weather";

export const runtime = "nodejs";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// 5 分鐘記憶體快取 (單一 Vercel Function instance 節流優化)
let cwaCache: { records: ParsedCwaRecord[]; timestamp: number } | null = null;
const CWA_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 將 ParsedCwaRecord 轉換為相容前端的 ForecastRecord
 */
function toForecastRecord(r: ParsedCwaRecord, index: number): ForecastRecord {
  return {
    id: index + 1,
    city: r.city,
    forecastStart: r.forecastStart,
    forecastEnd: r.forecastEnd,
    forecastDate: r.forecastDate,
    minTemp: r.minTemp,
    maxTemp: r.maxTemp,
    avgTemp: r.avgTemp,
    weatherDescription: r.weatherDescription,
    rainProbability: r.rainProbability,
    sourceUpdatedAt: r.sourceUpdatedAt,
    createdAt: r.sourceUpdatedAt,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const city = searchParams.get("city");

  // 1. 參數互斥與存在性檢查
  if (date && city) {
    return NextResponse.json(
      { error: "不可同時提供 date 與 city 參數" },
      { status: 400 }
    );
  }

  if (!date && !city) {
    return NextResponse.json(
      { error: "必須提供 date 或 city 查詢參數 (例如: ?date=2026-09-21 或 ?city=臺北市)" },
      { status: 400 }
    );
  }

  if (date && !DATE_REGEX.test(date)) {
    return NextResponse.json(
      { error: "日期格式無效，請使用 YYYY-MM-DD 格式 (例如: 2026-09-21)" },
      { status: 400 }
    );
  }

  const trimmedCity = city ? city.trim() : null;
  if (city !== null && (!trimmedCity || trimmedCity.length === 0)) {
    return NextResponse.json(
      { error: "縣市名稱不可為空" },
      { status: 400 }
    );
  }

  // 2. CWA 直接優先策略 (CWA First)
  let cwaRecords: ParsedCwaRecord[] | null = null;
  const now = Date.now();

  // (A) 檢查單一 instance 記憶體快取是否仍有效 (5 分鐘)
  if (cwaCache && now - cwaCache.timestamp < CWA_CACHE_TTL_MS) {
    cwaRecords = cwaCache.records;
  } else {
    // (B) 若無有效快取，伺服器端使用 CWA_API_KEY 向 CWA API 請求最新預報
    const cwaApiKey = process.env.CWA_API_KEY;
    if (cwaApiKey && cwaApiKey.trim().length > 0) {
      try {
        const freshRecords = await fetchCwaForecasts(cwaApiKey.trim());
        if (freshRecords && freshRecords.length > 0) {
          cwaRecords = freshRecords;
          cwaCache = {
            records: freshRecords,
            timestamp: now,
          };

          // (C) 非阻塞 / best-effort 寫入 Supabase (或本機 SQLite)
          // 附帶短暫 timeout，寫入失敗絕不影響向前端回傳 CWA 資料
          Promise.race([
            upsertForecastRecords(freshRecords),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Database upsert timeout")), 3000)
            ),
          ]).catch((err) => {
            console.warn("Best-effort DB upsert notice (non-fatal):", (err as Error).message);
          });
        }
      } catch (err) {
        console.warn("CWA API fetch failed, falling back to database cache:", (err as Error).message);
      }
    }
  }

  // 3. 若成功取得 CWA 資料 (包含 5 分鐘快取)，立刻回傳給前端 (source: "cwa")
  if (cwaRecords && cwaRecords.length > 0) {
    if (date) {
      const filtered = cwaRecords.filter((r) => r.forecastDate === date);
      if (filtered.length === 0) {
        return NextResponse.json(
          { error: `找不到日期為 ${date} 的預報資料` },
          { status: 404 }
        );
      }
      const responseBody: WeatherApiResponse = {
        source: "cwa",
        count: filtered.length,
        data: filtered.map(toForecastRecord),
      };
      return NextResponse.json(responseBody);
    }

    if (trimmedCity) {
      const filtered = cwaRecords.filter((r) => r.city === trimmedCity);
      if (filtered.length === 0) {
        return NextResponse.json(
          { error: `找不到縣市為「${trimmedCity}」的預報資料` },
          { status: 404 }
        );
      }
      const responseBody: WeatherApiResponse = {
        source: "cwa",
        count: filtered.length,
        data: filtered.map(toForecastRecord),
      };
      return NextResponse.json(responseBody);
    }
  }

  // 4. CWA 無法使用時，才嘗試從 Supabase (或本機開發 SQLite) 讀取最後一次成功同步的資料 (source: "database-cache")
  try {
    if (date) {
      const dbRecords = await getForecastsByDate(date);
      if (dbRecords && dbRecords.length > 0) {
        const responseBody: WeatherApiResponse = {
          source: "database-cache",
          count: dbRecords.length,
          data: dbRecords,
        };
        return NextResponse.json(responseBody);
      }
    }

    if (trimmedCity) {
      const dbRecords = await getForecastsByCity(trimmedCity);
      if (dbRecords && dbRecords.length > 0) {
        const responseBody: WeatherApiResponse = {
          source: "database-cache",
          count: dbRecords.length,
          data: dbRecords,
        };
        return NextResponse.json(responseBody);
      }
    }
  } catch (err) {
    console.warn("Database fallback query failed:", (err as Error).message);
  }

  // 5. 只有 CWA 與 Supabase 都無法提供資料時，才回傳 HTTP 503
  return NextResponse.json(
    { error: "天氣資料服務暫時無法使用 (CWA 與資料庫備援皆無法取得資料)" },
    { status: 503 }
  );
}

