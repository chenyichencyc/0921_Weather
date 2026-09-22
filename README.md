# 台灣 CWA 天氣 GIS 儀表板 (0921_Weather)

台灣天氣預報 GIS 儀表板，整合中央氣象署 (CWA) 開放資料、SQLite/PostgreSQL 資料庫與 Leaflet 地圖呈現。

## 🌤️ 專案簡介

本專案使用 Next.js (App Router) + TypeScript + Tailwind CSS 建立前端與 API，本機支援 SQLite 輕量化開發，公開部署支援 Supabase PostgreSQL 雲端資料庫，並提供整合 Leaflet GIS 地圖與 Recharts 圖表的視覺化儀表板。

## 🔑 CWA API 設定

本專案之天氣資料來源為**交通部中央氣象署開放資料平台**。

1. 前往 [中央氣象署開放資料平台](https://opendata.cwa.gov.tw/) 註冊並取得個人的「氣象資料開放平台會員授權碼」（API Key）。
2. 在專案根目錄建立 `.env` 檔案（或複製範本）：
   ```bash
   cp .env.example .env
   ```
3. 在 `.env` 中填入你的授權碼：
   ```env
   CWA_API_KEY=你的CWA授權碼
   ```
   > ⚠️ **資安注意**：`.env` 包含敏感金鑰，已設定於 `.gitignore` 中，請勿將包含真實金鑰的 `.env` 提交或推送到 GitHub 等公開儲存庫。

## ☁️ 雲端資料庫設定 (Supabase PostgreSQL - Milestone 6)

本專案支援雙模式資料庫（Dual-Database Mode）：
- **本機模式**：未設定 `DATABASE_URL` 時，自動使用本機 `data/weather.db` (SQLite)。
- **雲端模式**：設定 `DATABASE_URL` 時，自動無縫切換為 Supabase PostgreSQL。

### 1. 建立 Supabase 專案與資料表
1. 註冊/登入 [Supabase](https://supabase.com/) 並建立新專案。
2. 進入專案的 **SQL Editor**，開啟並執行專案內的 [`scripts/init_supabase.sql`](scripts/init_supabase.sql)。
3. 在 Supabase **Project Settings -> Database** 複製 **Connection URI** (Transaction Pooler 或 Session Connection String)。

### 2. 設定環境變數
在 `.env` 或 Vercel Environment Variables 加入：
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

### 3. 同步最新氣象資料至 Supabase
```bash
python scripts/refresh_supabase.py
```

## 🗺️ 台灣 GIS 互動地圖 (Milestone 5)

- **Leaflet + GeoJSON 多邊形地圖**：繪製台灣 22 縣市完整行政區邊界。
- **溫度著色規則 (avgTemp)**：
  - `≥ 30°C`：紅色（炎熱）
  - `25–29.9°C`：橘黃色（溫暖）
  - `20–24.9°C`：綠色（舒適）
  - `< 20°C`：藍色（偏涼）
  - 無資料：灰色
- **互動機制**：
  - **Hover**：顯示縣市名稱、平均溫與天氣現象 Tooltip。
  - **Click**：跳出詳細天氣 Popup，並連動儀表板（溫度卡片、折線圖與資料表）同步切換至該縣市。
- **圖資來源與授權**：
  - 資料集：台灣縣市行政邊界 GeoJSON (`twCounty2010.geo.json`)
  - 來源：[g0v/twgeojson](https://github.com/g0v/twgeojson)（基於政府行政區劃開放資料整理）
  - 授權條款：政府資料開放授權條款 (Open Government Data License) / CC0 / ODbL
  - 使用日期：2026-09-21
  - 本地儲存：`data/taiwan-cities.geojson` 及 `public/data/taiwan-cities.geojson`

## 📊 天氣儀表板 UI (Milestone 4)

- **三大控制項**：縣市選擇器、預報日期選擇器、預報時段選擇器。
- **指標資訊卡 (TemperatureCards)**：即時呈現選定縣市與時段之最低溫、最高溫、平均溫、天氣現象與降雨機率。
- **溫度走勢折線圖 (TemperatureChart)**：使用 Recharts 呈現選定縣市 36 小時逐時段高低氣溫變化與繁體中文互動 Tooltip。
- **全台縣市預報總表 (ForecastTable)**：呈現選定時段下全台 22 縣市天氣指標，支援點擊切換縣市。
- **狀態防護**：具備載入中 Skeleton、API 錯誤重試提示及資料庫未初始化導引。

## 🐍 Python 本機 SQLite 資料管線 (Milestone 2)

### 1. 建立並啟用 Python 虛擬環境
```bash
python3 -m venv venv
source venv/bin/activate  # macOS / Linux
# 或 Windows: venv\Scripts\activate
```

### 2. 安裝 Python 套件
```bash
pip install -r requirements.txt
```

### 3. 初始化 SQLite 資料庫
建立 `data/weather.db` 與 `forecasts` 資料表：
```bash
python scripts/init_sqlite.py
```

### 4. 抓取 CWA 最新預報並寫入資料庫 (Upsert)
```bash
python scripts/refresh_sqlite.py
```

## 📡 網站 API 規格 (Milestone 3)

### 1. 取得指定日期全台天氣預報
- **端點**：`GET /api/weather?date=YYYY-MM-DD`
- **範例**：
  ```bash
  curl http://localhost:3000/api/weather?date=2026-09-21
  ```

### 2. 取得指定縣市所有預報時段
- **端點**：`GET /api/weather?city={縣市名稱}`
- **範例**：
  ```bash
  curl "http://localhost:3000/api/weather?city=臺北市"
  ```

## 🚀 前端啟動方式 (Local Development)

### 1. 安裝前端相依套件
```bash
npm install
```

### 2. 驗證 CWA API 連線
執行官方 API 檢查腳本，確認金鑰與回傳格式正常：
```bash
node scripts/inspect-cwa.mjs
```

### 3. 啟動開發伺服器
```bash
npm run dev
```
瀏覽器開啟 [http://localhost:3000](http://localhost:3000)。

## 🧪 測試與建置 (Testing & Build)

### 執行 Lint 檢查
```bash
npm run lint
```

### 執行 Production Build
```bash
npm run build
```

### 啟動 Production 伺服器
```bash
npm run start
```

### 驗證健康狀態端點
```bash
curl http://localhost:3000/api/health
# 回傳: {"status":"ok"}
```

## 📄 授權與說明
本專案為課程作業與學習用途。
