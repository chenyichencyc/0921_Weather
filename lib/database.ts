import Database from "better-sqlite3";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { ForecastRecord } from "@/types/weather";

interface RawDbRow {
  id: number;
  city: string;
  forecast_start: string;
  forecast_end: string;
  forecast_date: string;
  min_temp: number | string;
  max_temp: number | string;
  avg_temp: number | string;
  weather_description: string;
  rain_probability: number | null;
  source_updated_at: string | null;
  created_at: string;
}

const DB_PATH = path.resolve(process.cwd(), "data", "weather.db");

// 檢查是否配置雲端 PostgreSQL (Supabase / Neon / Vercel Postgres)
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pgPool: Pool | null = null;
if (DATABASE_URL) {
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

/**
 * 檢查資料庫連線準備狀態（PostgreSQL 優先，其次本機 SQLite）
 */
export async function isDatabaseReady(): Promise<boolean> {
  if (pgPool) {
    try {
      const client = await pgPool.connect();
      client.release();
      return true;
    } catch {
      return false;
    }
  }
  return fs.existsSync(DB_PATH);
}

/**
 * 將資料庫 snake_case 列轉換為 camelCase 物件
 */
function formatRow(row: RawDbRow): ForecastRecord {
  return {
    id: Number(row.id),
    city: row.city,
    forecastStart: row.forecast_start,
    forecastEnd: row.forecast_end,
    forecastDate: row.forecast_date,
    minTemp: Number(row.min_temp),
    maxTemp: Number(row.max_temp),
    avgTemp: Number(row.avg_temp),
    weatherDescription: row.weather_description,
    rainProbability: row.rain_probability !== null ? Number(row.rain_probability) : null,
    sourceUpdatedAt: row.source_updated_at ? String(row.source_updated_at) : null,
    createdAt: String(row.created_at),
  };
}

/**
 * 查詢指定日期 (YYYY-MM-DD) 的全台天氣預報
 */
export async function getForecastsByDate(date: string): Promise<ForecastRecord[]> {
  // 1. 若配置了雲端 PostgreSQL
  if (pgPool) {
    const res = await pgPool.query<RawDbRow>(
      `SELECT id, city, forecast_start, forecast_end, forecast_date,
              min_temp, max_temp, avg_temp, weather_description,
              rain_probability, source_updated_at, created_at
       FROM forecasts
       WHERE forecast_date = $1
       ORDER BY city ASC, forecast_start ASC`,
      [date]
    );
    return res.rows.map(formatRow);
  }

  // 2. 本機 SQLite 查詢
  if (!fs.existsSync(DB_PATH)) {
    throw new Error("DB_NOT_FOUND");
  }
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const stmt = db.prepare<[string], RawDbRow>(`
      SELECT id, city, forecast_start, forecast_end, forecast_date,
             min_temp, max_temp, avg_temp, weather_description,
             rain_probability, source_updated_at, created_at
      FROM forecasts
      WHERE forecast_date = ?
      ORDER BY city ASC, forecast_start ASC
    `);
    const rows = stmt.all(date);
    return rows.map(formatRow);
  } finally {
    db.close();
  }
}

/**
 * 查詢指定縣市的所有預報時段
 */
export async function getForecastsByCity(city: string): Promise<ForecastRecord[]> {
  // 1. 若配置了雲端 PostgreSQL
  if (pgPool) {
    const res = await pgPool.query<RawDbRow>(
      `SELECT id, city, forecast_start, forecast_end, forecast_date,
              min_temp, max_temp, avg_temp, weather_description,
              rain_probability, source_updated_at, created_at
       FROM forecasts
       WHERE city = $1
       ORDER BY forecast_start ASC`,
      [city]
    );
    return res.rows.map(formatRow);
  }

  // 2. 本機 SQLite 查詢
  if (!fs.existsSync(DB_PATH)) {
    throw new Error("DB_NOT_FOUND");
  }
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const stmt = db.prepare<[string], RawDbRow>(`
      SELECT id, city, forecast_start, forecast_end, forecast_date,
             min_temp, max_temp, avg_temp, weather_description,
             rain_probability, source_updated_at, created_at
      FROM forecasts
      WHERE city = ?
      ORDER BY forecast_start ASC
    `);
    const rows = stmt.all(city);
    return rows.map(formatRow);
  } finally {
    db.close();
  }
}
