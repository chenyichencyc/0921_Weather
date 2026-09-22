import os
import sys
from pathlib import Path
import requests
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

def test_rls():
    load_dotenv(dotenv_path=ENV_PATH)
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url:
        print("❌ 未設定 SUPABASE_URL")
        return

    # 1. 測試以匿名身份 (若無任何 policy 允許) 請求 REST API
    # 建立一個模擬的無權限 anon 請求
    url = f"{supabase_url.rstrip('/')}/rest/v1/forecasts"
    anon_headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }

    print("=== 執行 Supabase RLS 安全政策驗證 ===")
    
    # 測試讀取
    read_res = requests.get(f"{url}?select=count", headers=anon_headers)
    print(f"1. REST API 讀取回應: HTTP {read_res.status_code}")
    if read_res.status_code == 200:
        data = read_res.json()
        print(f"   回傳筆數: {len(data) if isinstance(data, list) else data}")
    else:
        print(f"   回應內容: {read_res.text}")

    # 測試匿名寫入 (INSERT)
    fake_row = [{
        "city": "測試縣市",
        "forecast_start": "2099-01-01 00:00:00",
        "forecast_end": "2099-01-01 12:00:00",
        "forecast_date": "2099-01-01",
        "min_temp": 20,
        "max_temp": 25,
        "avg_temp": 22.5
    }]
    write_res = requests.post(url, headers=anon_headers, json=fake_row)
    print(f"2. 匿名 REST 寫入阻擋測試: HTTP {write_res.status_code}")
    if write_res.status_code in (401, 403) or "violates row-level security policy" in write_res.text:
        print("   ✅ 成功驗證：匿名寫入已被 RLS 嚴格阻擋！")
    elif write_res.status_code in (200, 201, 204):
        print("   ⚠️ 警告：目前 RLS 仍允許寫入，請確認已在 SQL Editor 執行 DROP POLICY 指令。")
        # 清理測試列
        requests.delete(f"{url}?city=eq.測試縣市", headers=anon_headers)

if __name__ == "__main__":
    test_rls()
