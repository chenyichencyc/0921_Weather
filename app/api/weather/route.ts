import { NextRequest, NextResponse } from "next/server";
import {
  isDatabaseReady,
  getForecastsByDate,
  getForecastsByCity,
} from "@/lib/database";

export const runtime = "nodejs";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

  // 2. 檢查資料庫是否已就緒
  const ready = await isDatabaseReady();
  if (!ready) {
    return NextResponse.json(
      {
        error: "資料庫尚未初始化或無法連線，請先在本機執行 python scripts/init_sqlite.py 與 python scripts/refresh_sqlite.py 建立並更新資料庫，或設定 DATABASE_URL 連線至雲端 PostgreSQL。",
      },
      { status: 503 }
    );
  }

  try {
    // 3. 依據 date 查詢
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

    // 4. 依據 city 查詢
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
  } catch (error) {
    const err = error as Error;
    if (err.message === "DB_NOT_FOUND") {
      return NextResponse.json(
        {
          error: "資料庫尚未初始化，請先在本機執行 python scripts/init_sqlite.py 與 python scripts/refresh_sqlite.py",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "伺服器內部錯誤，無法讀取天氣資料" },
      { status: 500 }
    );
  }
}
