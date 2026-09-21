import os
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
import requests
from dotenv import load_dotenv

# 路徑設定
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "weather.db"
ENV_PATH = ROOT_DIR / ".env"

DATASET_ID = "F-C0032-001"
API_URL = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/{DATASET_ID}"

UPSERT_SQL = """
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
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(city, forecast_start, forecast_end) DO UPDATE SET
    forecast_date = excluded.forecast_date,
    min_temp = excluded.min_temp,
    max_temp = excluded.max_temp,
    avg_temp = excluded.avg_temp,
    weather_description = excluded.weather_description,
    rain_probability = excluded.rain_probability,
    source_updated_at = excluded.source_updated_at;
"""


def get_api_key() -> str:
    """安全取得 CWA API Key，不印出金鑰"""
    load_dotenv(dotenv_path=ENV_PATH)
    api_key = os.getenv("CWA_API_KEY")
    if not api_key:
        print("❌ 錯誤：找不到環境變數 CWA_API_KEY，請確認 .env 檔案存在並已設定金鑰。", file=sys.stderr)
        sys.exit(1)
    return api_key.strip().strip("'\"")


def fetch_cwa_data(api_key: str) -> dict:
    """向 CWA API 請求最新預報資料"""
    try:
        response = requests.get(
            API_URL,
            params={"Authorization": api_key},
            timeout=15
        )
        if response.status_code != 200:
            print(f"❌ 錯誤：CWA API 請求失敗，HTTP 狀態碼: {response.status_code}", file=sys.stderr)
            sys.exit(1)
        
        data = response.json()
        if not data.get("success") or "records" not in data or "location" not in data["records"]:
            print("❌ 錯誤：CWA API 回傳 JSON 結構異常，缺少 records.location", file=sys.stderr)
            sys.exit(1)
            
        return data
    except requests.RequestException as e:
        # 遮蔽可能的 URL 查詢參數包含的金鑰
        safe_msg = re.sub(r"Authorization=[^&]+", "Authorization=[REDACTED]", str(e))
        print(f"❌ 網路連線錯誤：{safe_msg}", file=sys.stderr)
        sys.exit(1)


def parse_weather_records(data: dict) -> list[tuple]:
    """解析並清理 CWA 預報資料"""
    records_list = []
    locations = data["records"]["location"]
    source_updated_at = datetime.now().isoformat()

    for loc in locations:
        city = loc.get("locationName", "").strip()
        if not city:
            continue

        elements = {el["elementName"]: el.get("time", []) for el in loc.get("weatherElement", [])}
        min_t_times = {t["startTime"]: t for t in elements.get("MinT", [])}
        max_t_times = {t["startTime"]: t for t in elements.get("MaxT", [])}
        wx_times = {t["startTime"]: t for t in elements.get("Wx", [])}
        pop_times = {t["startTime"]: t for t in elements.get("PoP", [])}

        all_start_times = sorted(set(min_t_times.keys()) | set(max_t_times.keys()))

        for start_time in all_start_times:
            min_entry = min_t_times.get(start_time, {})
            max_entry = max_t_times.get(start_time, {})
            wx_entry = wx_times.get(start_time, {})
            pop_entry = pop_times.get(start_time, {})

            end_time = min_entry.get("endTime") or max_entry.get("endTime") or ""
            if not end_time:
                continue

            # 日期部分 YYYY-MM-DD
            forecast_date = start_time.split(" ")[0] if " " in start_time else start_time[:10]

            # 溫度轉數字
            try:
                min_temp = float(min_entry.get("parameter", {}).get("parameterName", 0))
                max_temp = float(max_entry.get("parameter", {}).get("parameterName", 0))
            except (ValueError, TypeError):
                continue

            avg_temp = round((min_temp + max_temp) / 2.0, 1)
            wx_desc = wx_entry.get("parameter", {}).get("parameterName", "")
            
            pop_raw = pop_entry.get("parameter", {}).get("parameterName", "")
            pop = int(pop_raw) if pop_raw.isdigit() else None

            records_list.append((
                city,
                start_time,
                end_time,
                forecast_date,
                min_temp,
                max_temp,
                avg_temp,
                wx_desc,
                pop,
                source_updated_at
            ))

    return records_list


def save_to_sqlite(records: list[tuple], db_path: Path = DB_PATH) -> int:
    """使用 Transaction 與 Upsert 寫入 SQLite"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        with conn:
            # 確保資料表已存在
            from init_sqlite import SCHEMA_SQL
            conn.executescript(SCHEMA_SQL)
            conn.executemany(UPSERT_SQL, records)
        return len(records)
    finally:
        conn.close()


def main():
    print("=== 開始自 CWA API 更新天氣資料至 SQLite ===")
    api_key = get_api_key()
    raw_data = fetch_cwa_data(api_key)
    parsed_records = parse_weather_records(raw_data)
    
    if not parsed_records:
        print("⚠️ 未解析到任何預報資料。")
        return

    written_count = save_to_sqlite(parsed_records)
    distinct_cities = len(set(r[0] for r in parsed_records))
    
    print(f" 成功寫入/更新 {written_count} 筆預報資料（涵蓋 {distinct_cities} 個縣市）")
    print(f" 資料庫檔案: {DB_PATH}")


if __name__ == "__main__":
    main()
