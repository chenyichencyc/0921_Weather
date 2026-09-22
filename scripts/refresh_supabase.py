import os
import re
import sys
from datetime import datetime
from pathlib import Path
import requests
from dotenv import load_dotenv
from refresh_sqlite import get_api_key, fetch_cwa_data, parse_weather_records

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"


def get_supabase_config():
    load_dotenv(dotenv_path=ENV_PATH)
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
    db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    return supabase_url, supabase_key, db_url


def sync_via_rest_api(supabase_url: str, supabase_key: str, parsed_records: list[tuple]) -> int:
    """使用 Supabase PostgREST API 執行 Upsert"""
    url = f"{supabase_url.rstrip('/')}/rest/v1/forecasts?on_conflict=city,forecast_start,forecast_end"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,count=exact",
    }

    # 轉換成 JSON 物件清單
    rows = []
    for r in parsed_records:
        city, start, end, date, min_t, max_t, avg_t, wx, pop, updated_at = r
        rows.append({
            "city": city,
            "forecast_start": start,
            "forecast_end": end,
            "forecast_date": date,
            "min_temp": min_t,
            "max_temp": max_t,
            "avg_temp": avg_t,
            "weather_description": wx,
            "rain_probability": pop,
            "source_updated_at": updated_at,
        })

    try:
        response = requests.post(url, headers=headers, json=rows, timeout=15)
        if response.status_code not in (200, 201, 204):
            # 檢查是否為尚未建表的錯誤
            if "relation \"public.forecasts\" does not exist" in response.text or "42P01" in response.text:
                print("❌ 錯誤：Supabase 資料庫中尚未建立 forecasts 資料表！", file=sys.stderr)
                print("👉 請先至 Supabase 後台 SQL Editor 貼上並執行 scripts/init_supabase.sql 建立資料表。", file=sys.stderr)
                sys.exit(1)
            print(f"❌ Supabase REST API 寫入失敗 (狀態碼: {response.status_code}): {response.text}", file=sys.stderr)
            sys.exit(1)

        return len(rows)
    except requests.RequestException as e:
        safe_msg = re.sub(r"Bearer\s+[^\s]+", "Bearer [REDACTED]", str(e))
        print(f"❌ 網路連線錯誤: {safe_msg}", file=sys.stderr)
        sys.exit(1)


def sync_via_postgres(db_url: str, parsed_records: list[tuple]) -> int:
    """使用 PostgreSQL Direct Connection 執行 Upsert"""
    import psycopg2
    from psycopg2.extras import execute_values
    from refresh_supabase import POSTGRES_UPSERT_SQL

    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                execute_values(cur, POSTGRES_UPSERT_SQL, parsed_records)
        conn.close()
        return len(parsed_records)
    except psycopg2.Error as e:
        safe_msg = re.sub(r"://([^:]+):([^@]+)@", r"://\1:[REDACTED]@", str(e))
        print(f"❌ PostgreSQL 資料庫寫入錯誤: {safe_msg}", file=sys.stderr)
        sys.exit(1)


def main():
    print("=== 開始自 CWA API 更新天氣資料至 Supabase ===")
    cwa_api_key = get_api_key()
    supabase_url, supabase_key, db_url = get_supabase_config()

    if not ((supabase_url and supabase_key) or db_url):
        print("❌ 錯誤：未在 .env 中找到 Supabase 設定 (需提供 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 或 DATABASE_URL)", file=sys.stderr)
        sys.exit(1)

    raw_data = fetch_cwa_data(cwa_api_key)
    parsed_records = parse_weather_records(raw_data)

    if not parsed_records:
        print("⚠️ 未解析到任何預報資料。")
        return

    if supabase_url and supabase_key:
        written_count = sync_via_rest_api(supabase_url, supabase_key, parsed_records)
    else:
        written_count = sync_via_postgres(db_url, parsed_records)

    distinct_cities = len(set(r[0] for r in parsed_records))
    print(f" 成功寫入/更新 Supabase {written_count} 筆預報資料（涵蓋 {distinct_cities} 個縣市）")


if __name__ == "__main__":
    main()
