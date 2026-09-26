import Database from "better-sqlite3";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { ForecastRecord } from "@/types/weather";
import { ParsedCwaRecord } from "@/lib/cwa";

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

// 正式環境僅透過 DATABASE_URL 連線至 Supabase PostgreSQL (Transaction Pooler)
const DATABASE_URL = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

let pgPool: Pool | null = null;
if (DATABASE_URL) {
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
}

/**
 * 檢查環境變數與資料庫連線準備狀態
 */
export async function getDatabaseStatus(): Promise<{
  ready: boolean;
  isProduction: boolean;
  hasDatabaseUrl: boolean;
  error?: string;
}> {
  const hasDatabaseUrl = Boolean(DATABASE_URL && DATABASE_URL.trim().length > 0);

  // 1. 在 Vercel / Production 環境，必須要有 DATABASE_URL，不可回退至本機 SQLite
  if (isProduction) {
    if (!hasDatabaseUrl) {
      return {
        ready: false,
        isProduction: true,
        hasDatabaseUrl: false,
        error: "缺少 DATABASE_URL 環境變數，無法連線至雲端資料庫",
      };
    }

    if (pgPool) {
      try {
        const client = await pgPool.connect();
        client.release();
        return {
          ready: true,
          isProduction: true,
          hasDatabaseUrl: true,
        };
      } catch (err) {
        const error = err as Error & { code?: string };
        console.error("Database connection failure code:", error.code || error.name, error.message);
        return {
          ready: false,
          isProduction: true,
          hasDatabaseUrl: true,
          error: "雲端資料庫連線失敗，請檢查 DATABASE_URL 設定",
        };
      }
    }
  }

  // 2. 本機開發環境：若有設定 DATABASE_URL 優先測試連線
  if (hasDatabaseUrl && pgPool) {
    try {
      const client = await pgPool.connect();
      client.release();
      return {
        ready: true,
        isProduction: false,
        hasDatabaseUrl: true,
      };
    } catch {
      // 本機連線失敗可回退檢查 SQLite
    }
  }

  // 3. 本機開發環境：檢查本機 SQLite 檔案是否存在
  if (fs.existsSync(DB_PATH)) {
    return {
      ready: true,
      isProduction: false,
      hasDatabaseUrl,
    };
  }

  return {
    ready: false,
    isProduction: false,
    hasDatabaseUrl,
    error: "資料庫尚未初始化，請先執行 Python 初始化腳本或設定 DATABASE_URL",
  };
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
 * 安全 Upsert 預報資料至資料庫 (PostgreSQL 優先，本機開發可回退 SQLite)
 */
export async function upsertForecastRecords(records: ParsedCwaRecord[]): Promise<number> {
  if (records.length === 0) return 0;

  // 1. PostgreSQL (Supabase Transaction Pooler)
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const upsertSql = `
        INSERT INTO forecasts (
          city, forecast_start, forecast_end, forecast_date,
          min_temp, max_temp, avg_temp, weather_description,
          rain_probability, source_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (city, forecast_start, forecast_end) DO UPDATE SET
          forecast_date = EXCLUDED.forecast_date,
          min_temp = EXCLUDED.min_temp,
          max_temp = EXCLUDED.max_temp,
          avg_temp = EXCLUDED.avg_temp,
          weather_description = EXCLUDED.weather_description,
          rain_probability = EXCLUDED.rain_probability,
          source_updated_at = EXCLUDED.source_updated_at;
      `;

      for (const r of records) {
        await client.query(upsertSql, [
          r.city,
          r.forecastStart,
          r.forecastEnd,
          r.forecastDate,
          r.minTemp,
          r.maxTemp,
          r.avgTemp,
          r.weatherDescription,
          r.rainProbability,
          r.sourceUpdatedAt,
        ]);
      }
      await client.query("COMMIT");
      return records.length;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  // 2. 若在 production 且無 pgPool 則不可寫入 SQLite
  if (isProduction) {
    throw new Error("Missing DATABASE_URL in production environment");
  }

  // 3. 本機 SQLite
  if (fs.existsSync(DB_PATH)) {
    const db = new Database(DB_PATH);
    try {
      const stmt = db.prepare(`
        INSERT INTO forecasts (
          city, forecast_start, forecast_end, forecast_date,
          min_temp, max_temp, avg_temp, weather_description,
          rain_probability, source_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(city, forecast_start, forecast_end) DO UPDATE SET
          forecast_date = excluded.forecast_date,
          min_temp = excluded.min_temp,
          max_temp = excluded.max_temp,
          avg_temp = excluded.avg_temp,
          weather_description = excluded.weather_description,
          rain_probability = excluded.rain_probability,
          source_updated_at = excluded.source_updated_at;
      `);

      const insertMany = db.transaction((rows: ParsedCwaRecord[]) => {
        for (const r of rows) {
          stmt.run(
            r.city,
            r.forecastStart,
            r.forecastEnd,
            r.forecastDate,
            r.minTemp,
            r.maxTemp,
            r.avgTemp,
            r.weatherDescription,
            r.rainProbability,
            r.sourceUpdatedAt
          );
        }
      });

      insertMany(records);
      return records.length;
    } finally {
      db.close();
    }
  }

  return 0;
}

/**
 * 查詢指定日期 (YYYY-MM-DD) 的全台天氣預報
 */
export async function getForecastsByDate(date: string): Promise<ForecastRecord[]> {
  // 1. PostgreSQL (Supabase Transaction Pooler)
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

  // 2. Production 環境缺少 DATABASE_URL 時不可退回 SQLite
  if (isProduction) {
    return [];
  }

  // 3. 本機開發模式：SQLite 查詢
  if (fs.existsSync(DB_PATH)) {
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

  return [];
}

/**
 * 查詢指定縣市的所有預報時段
 */
export async function getForecastsByCity(city: string): Promise<ForecastRecord[]> {
  // 1. PostgreSQL (Supabase Transaction Pooler)
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

  // 2. Production 環境缺少 DATABASE_URL 時不可退回 SQLite
  if (isProduction) {
    return [];
  }

  // 3. 本機開發模式：SQLite 查詢
  if (fs.existsSync(DB_PATH)) {
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

  return [];
}
