import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export interface ForecastRecord {
  id: number;
  city: string;
  forecastStart: string;
  forecastEnd: string;
  forecastDate: string;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  weatherDescription: string;
  rainProbability: number | null;
  sourceUpdatedAt: string | null;
  createdAt: string;
}

interface RawDbRow {
  id: number;
  city: string;
  forecast_start: string;
  forecast_end: string;
  forecast_date: string;
  min_temp: number;
  max_temp: number;
  avg_temp: number;
  weather_description: string;
  rain_probability: number | null;
  source_updated_at: string | null;
  created_at: string;
}

const DB_PATH = path.resolve(process.cwd(), "data", "weather.db");

/**
 * 檢查 SQLite 資料庫檔案是否存在
 */
export function isDatabaseReady(): boolean {
  return fs.existsSync(DB_PATH);
}

/**
 * 取得 SQLite 資料庫連線實例
 */
function getDbConnection(): Database.Database {
  if (!isDatabaseReady()) {
    throw new Error("DB_NOT_FOUND");
  }
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
}

/**
 * 將資料庫 snake_case 列轉換為 camelCase 物件
 */
function formatRow(row: RawDbRow): ForecastRecord {
  return {
    id: row.id,
    city: row.city,
    forecastStart: row.forecast_start,
    forecastEnd: row.forecast_end,
    forecastDate: row.forecast_date,
    minTemp: row.min_temp,
    maxTemp: row.max_temp,
    avgTemp: row.avg_temp,
    weatherDescription: row.weather_description,
    rainProbability: row.rain_probability,
    sourceUpdatedAt: row.source_updated_at,
    createdAt: row.created_at,
  };
}

/**
 * 查詢指定日期 (YYYY-MM-DD) 的全台天氣預報
 */
export function getForecastsByDate(date: string): ForecastRecord[] {
  const db = getDbConnection();
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
export function getForecastsByCity(city: string): ForecastRecord[] {
  const db = getDbConnection();
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
