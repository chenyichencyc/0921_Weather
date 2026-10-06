import os
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
import pandas as pd
import requests
try:
    from init_sqlite import SCHEMA_SQL, init_database
except ImportError:
    from scripts.init_sqlite import SCHEMA_SQL, init_database


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


def normalize_cwa_to_dataframe(data: dict) -> pd.DataFrame:
    """使用 Pandas 將 CWA 預報 JSON 正規化為結構化 DataFrame"""
    raw_rows = []
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

            raw_rows.append({
                "city": city,
                "forecast_start": start_time,
                "forecast_end": end_time,
                "min_temp_raw": min_entry.get("parameter", {}).get("parameterName"),
                "max_temp_raw": max_entry.get("parameter", {}).get("parameterName"),
                "weather_description": wx_entry.get("parameter", {}).get("parameterName", ""),
                "rain_probability_raw": pop_entry.get("parameter", {}).get("parameterName"),
                "source_updated_at": source_updated_at,
            })

    if not raw_rows:
        return pd.DataFrame()

    # 轉為 Pandas DataFrame 進行資料清理與型別轉換
    df = pd.DataFrame(raw_rows)

    # 數值型別轉換與清理
    df["min_temp"] = pd.to_numeric(df["min_temp_raw"], errors="coerce")
    df["max_temp"] = pd.to_numeric(df["max_temp_raw"], errors="coerce")
    df = df.dropna(subset=["min_temp", "max_temp"]).copy()

    # 計算平均溫
    df["avg_temp"] = ((df["min_temp"] + df["max_temp"]) / 2.0).round(1)

    # 提取預報日期 YYYY-MM-DD
    df["forecast_date"] = df["forecast_start"].apply(
        lambda s: s.split(" ")[0] if " " in str(s) else str(s)[:10]
    )

    # 處理降雨機率
    df["rain_probability"] = pd.to_numeric(df["rain_probability_raw"], errors="coerce").astype("Int64")

    # 選取標準欄位順序
    target_cols = [
        "city",
        "forecast_start",
        "forecast_end",
        "forecast_date",
        "min_temp",
        "max_temp",
        "avg_temp",
        "weather_description",
        "rain_probability",
        "source_updated_at",
    ]
    return df[target_cols]


def save_dataframe_to_sqlite(df: pd.DataFrame, db_path: Path = DB_PATH) -> int:
    """使用 Pandas DataFrame 搭配 Transaction 與 Upsert 寫入 SQLite"""
    if df.empty:
        return 0

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    init_database(db_path)

    # 將 DataFrame 轉換為適合 SQLite executemany 的 tuple 陣列 (處理 NA -> None)
    records = []
    for row in df.to_dict(orient="records"):
        records.append((
            row["city"],
            row["forecast_start"],
            row["forecast_end"],
            row["forecast_date"],
            float(row["min_temp"]),
            float(row["max_temp"]),
            float(row["avg_temp"]),
            str(row["weather_description"]),
            int(row["rain_probability"]) if pd.notna(row["rain_probability"]) else None,
            row["source_updated_at"],
        ))

    conn = sqlite3.connect(db_path)
    try:
        with conn:
            conn.executemany(UPSERT_SQL, records)
        return len(records)
    finally:
        conn.close()


def main():
    print("=== 開始自 CWA API 更新天氣資料至 SQLite (Pandas 管線) ===")
    api_key = get_api_key()
    raw_data = fetch_cwa_data(api_key)
    
    # 透過 Pandas 進行結構化清理與轉換
    df = normalize_cwa_to_dataframe(raw_data)
    if df.empty:
        print("⚠️ 未解析到任何預報資料。")
        return

    written_count = save_dataframe_to_sqlite(df)
    distinct_cities = df["city"].nunique()
    
    print(f"✅ 成功寫入/更新 {written_count} 筆預報資料（涵蓋 {distinct_cities} 個縣市）")
    print(f"📊 Pandas DataFrame 摘要:")
    print(f"   - 欄位數: {df.shape[1]}, 總列數: {df.shape[0]}")
    print(f"   - 氣溫範圍: {df['min_temp'].min()}°C ~ {df['max_temp'].max()}°C")
    print(f"💾 資料庫檔案: {DB_PATH}")


if __name__ == "__main__":
    main()

