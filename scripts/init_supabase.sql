-- ==============================================================================
-- 台灣天氣 GIS 儀表板 - Supabase PostgreSQL 安全 RLS 初始化腳本
-- 安全強化規範：
-- 1. 啟用 Row Level Security (RLS)
-- 2. 移除所有允許 public / anon 的存取政策 (防止匿名公開繞過 Next.js 存取 REST API)
-- 3. 資料存取僅限 Next.js 伺服器端 (DATABASE_URL / Service Role) 與 Python 後台管線
-- ==============================================================================

-- 1. 建立預報資料表 (forecasts)
CREATE TABLE IF NOT EXISTS forecasts (
    id BIGSERIAL PRIMARY KEY,
    city VARCHAR(32) NOT NULL,
    forecast_start VARCHAR(32) NOT NULL,
    forecast_end VARCHAR(32) NOT NULL,
    forecast_date VARCHAR(16) NOT NULL,
    min_temp NUMERIC(4, 1) NOT NULL,
    max_temp NUMERIC(4, 1) NOT NULL,
    avg_temp NUMERIC(4, 1) NOT NULL,
    weather_description VARCHAR(64),
    rain_probability INTEGER,
    source_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_forecast_city_period UNIQUE (city, forecast_start, forecast_end)
);

-- 2. 建立常用查詢索引
CREATE INDEX IF NOT EXISTS idx_forecasts_city ON forecasts(city);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_start ON forecasts(forecast_start);

-- 3. 啟用 RLS 並移除所有公開存取 Policy
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read and write on forecasts" ON forecasts;
DROP POLICY IF EXISTS "Allow public read-only access on forecasts" ON forecasts;
DROP POLICY IF EXISTS "Allow anon select and upsert on forecasts" ON forecasts;
DROP POLICY IF EXISTS "Enable read access for all users" ON forecasts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON forecasts;
