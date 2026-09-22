-- ==============================================================================
-- 台灣天氣 GIS 儀表板 - Supabase PostgreSQL 初始化腳本 (Milestone 6)
-- 說明：請在 Supabase Dashboard -> SQL Editor 中貼上並執行此腳本。
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

-- 3. 設定 Row Level Security (RLS) - 允許公開讀取 (SELECT)
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access on forecasts" 
ON forecasts 
FOR SELECT 
TO anon, authenticated 
USING (true);
