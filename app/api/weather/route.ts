import { NextRequest, NextResponse } from "next/server";
import {
  getDatabaseStatus,
  getForecastsByDate,
  getForecastsByCity,
  upsertForecastRecords,
} from "@/lib/database";
import { fetchCwaForecasts } from "@/lib/cwa";

export const runtime = "nodejs";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// 記憶體內同步時間戳，避免短時間內對 CWA 頻繁重複請求 (限制 5 分鐘同步一次)
let lastCwaSyncTime = 0;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function syncWithCwaIfPossible() {
  const cwaApiKey = process.env.CWA_API_KEY;
  if (!cwaApiKey || !cwaApiKey.trim()) {
    // 缺少 CWA_API_KEY 時：不向 CWA 發送請求，安全回退讀取現有資料庫
    return;
  }

  const now = Date.now();
  if (now - lastCwaSyncTime < SYNC_INTERVAL_MS) {
    return;
  }

  try {
    const freshRecords = await fetchCwaForecasts(cwaApiKey);
    if (freshRecords.length > 0) {
      await upsertForecastRecords(freshRecords);
      lastCwaSyncTime = now;
    }
  } catch {
    // 安全捕捉：記錄安全錯誤訊息，不洩漏 API Key 或連線字串
    console.warn("CWA background sync notice: unable to sync fresh data, serving cached database records.");
  }
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

  // 2. 檢查資料庫狀態 (正式環境若缺少 DATABASE_URL 必須回傳 HTTP 503)
  const dbStatus = await getDatabaseStatus();
  if (!dbStatus.ready) {
    return NextResponse.json(
      {
        error: dbStatus.error || "資料庫服務無法連線",
      },
      { status: 503 }
    );
  }

  // 3. 若有設定 CWA_API_KEY，伺服器端嘗試同步最新氣象資料
  await syncWithCwaIfPossible();

  try {
    // 4. 依據 date 查詢全台資料
    if (date) {
      if (!DATE_REGEX.test(date)) {
        return NextResponse.json(
          { error: "日期格式無效，請使用 YYYY-MM-DD 格式 (例如: 2026-09-21)" },
          { status: 400 }
        );
      }

      const records = await getForecastsByDate(date);
      if (records.length === 0) {
        return NextResponse.json(
          { error: `找不到日期為 ${date} 的預報資料` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        count: records.length,
        data: records,
      });
    }

    // 5. 依據 city 查詢指定縣市資料
    if (city) {
      const trimmedCity = city.trim();
      if (!trimmedCity) {
        return NextResponse.json(
          { error: "縣市名稱不可為空" },
          { status: 400 }
        );
      }

      const records = await getForecastsByCity(trimmedCity);
      if (records.length === 0) {
        return NextResponse.json(
          { error: `找不到縣市為「${trimmedCity}」的預報資料` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        count: records.length,
        data: records,
      });
    }
  } catch {
    return NextResponse.json(
      { error: "伺服器內部錯誤，無法讀取天氣資料" },
      { status: 500 }
    );
  }
}
