import os
import re
import sys
from datetime import datetime
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from refresh_sqlite import get_api_key, fetch_cwa_data, parse_weather_records

# 路徑設定
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

POSTGRES_UPSERT_SQL = """
INSERT INTO forecasts (
    city,
    forecast_start,
    forecast_end,
    forecast_date,
    min_temp,
    max_temp,
    avg_temp,
    weather_description,
    rain_probability,
    source_updated_at
) VALUES %s
ON CONFLICT (city, forecast_start, forecast_end) DO UPDATE SET
    forecast_date = EXCLUDED.forecast_date,
    min_temp = EXCLUDED.min_temp,
    max_temp = EXCLUDED.max_temp,
    avg_temp = EXCLUDED.avg_temp,
    weather_description = EXCLUDED.weather_description,
    rain_probability = EXCLUDED.rain_probability,
    source_updated_at = EXCLUDED.source_updated_at;
"""


def get_database_url() -> str:
    """安全取得 DATABASE_URL，不印出密碼或連線字串"""
    load_dotenv(dotenv_path=ENV_PATH)
    db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not db_url:
        print("❌ 錯誤：找不到環境變數 DATABASE_URL，請先在 .env 中設定 Supabase 連線字串。", file=sys.stderr)
        sys.exit(1)
    return db_url.strip().strip("'\"")


def save_to_supabase(records: list[tuple], db_url: str) -> int:
    """使用 Transaction 與 Upsert 寫入 Supabase PostgreSQL"""
    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                execute_values(cur, POSTGRES_UPSERT_SQL, records)
        conn.close()
        return len(records)
    except psycopg2.Error as e:
        # 遮蔽可能的密碼資訊
        safe_msg = re.sub(r"://([^:]+):([^@]+)@", r"://\1:[REDACTED]@", str(e))
        print(f"❌ PostgreSQL 資料庫寫入錯誤：{safe_msg}", file=sys.stderr)
        sys.exit(1)


def main():
    print("=== 開始自 CWA API 更新天氣資料至 Supabase PostgreSQL ===")
    api_key = get_api_key()
    db_url = get_database_url()
    
    raw_data = fetch_cwa_data(api_key)
    parsed_records = parse_weather_records(raw_data)
    
    if not parsed_records:
        print("⚠️ 未解析到任何預報資料。")
        return

    written_count = save_to_supabase(parsed_records, db_url)
    distinct_cities = len(set(r[0] for r in parsed_records))
    
    print(f" 成功寫入/更新 Supabase PostgreSQL {written_count} 筆預報資料（涵蓋 {distinct_cities} 個縣市）")


if __name__ == "__main__":
    main()
