import sqlite3
from pathlib import Path

# 資料庫路徑：專案根目錄下的 data/weather.db
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "weather.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    forecast_start TEXT NOT NULL,
    forecast_end TEXT NOT NULL,
    forecast_date TEXT NOT NULL,
    min_temp REAL NOT NULL,
    max_temp REAL NOT NULL,
    avg_temp REAL NOT NULL,
    weather_description TEXT,
    rain_probability INTEGER,
    source_updated_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(city, forecast_start, forecast_end)
);

CREATE INDEX IF NOT EXISTS idx_forecasts_city ON forecasts(city);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_start ON forecasts(forecast_start);

-- 課程微課程海報步驟 9/10/12 相容 View: TemperatureForecasts
CREATE VIEW IF NOT EXISTS TemperatureForecasts AS
SELECT
    id,
    city AS regionName,
    forecast_date AS dataDate,
    min_temp AS minT,
    max_temp AS maxT,
    avg_temp AS avgT,
    weather_description,
    rain_probability,
    forecast_start,
    forecast_end
FROM forecasts;
"""


def init_database(db_path: Path = DB_PATH):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        with conn:
            conn.executescript(SCHEMA_SQL)
        print(f" SQLite 資料庫初始化成功: {db_path}")
    finally:
        conn.close()

    # 海報微課程相容：若根目錄需要 data.db，亦建立相容副本或符號連結
    root_data_db = ROOT_DIR / "data.db"
    try:
        if not root_data_db.exists():
            root_data_db.symlink_to(db_path)
    except Exception:
        pass


if __name__ == "__main__":
    init_database()
