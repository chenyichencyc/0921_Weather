# 台灣 CWA 天氣 GIS 儀表板 (0921_Weather)

台灣天氣預報 GIS 儀表板，整合中央氣象署 (CWA) 開放資料、SQLite/PostgreSQL 資料庫與 Leaflet 地圖呈現。

## 🌤️ 專案簡介

本專案使用 Next.js (App Router) + TypeScript + Tailwind CSS 建立前端與 API，本機支援 SQLite 輕量化開發，公開部署支援 Supabase PostgreSQL 雲端資料庫（Transaction Pooler），並提供整合 Leaflet GIS 地圖與 Recharts 圖表的視覺化儀表板。

## 🔑 環境變數設定

正式部署與伺服器端運作所需之環境變數如下：

1. **`DATABASE_URL`**：Supabase PostgreSQL Transaction Pooler URI（值必須以 `postgresql://` 開頭），供 Next.js 伺服器端連線雲端資料庫。
2. **`CWA_API_KEY`**：中央氣象署開放資料平台會員授權碼（API Key），僅供 Next.js 伺服器端向 CWA 官方 API 請求最新預報資料。

> ⚠️ **資安防護規範**：
> - 所有機密變數僅供後端伺服器存取，絕不透過 `NEXT_PUBLIC_` 暴露至瀏覽器前端。
> - `.env` 已加入 `.gitignore`，不得提交至 Git 或公開儲存庫。

## 🚀 GitHub 與 Vercel 自動部署

本專案支援 Vercel CI/CD 自動部署流程：

### 1. 在 Vercel 匯入 GitHub Repository
1. 登入 [Vercel](https://vercel.com/)。
2. 點擊 **Add New... -> Project**，匯入 `chenyichencyc/0921_Weather`。
3. Framework Preset 選擇 **Next.js**，Root Directory 選擇 `./`。

### 2. 設定 Vercel 環境變數 (Environment Variables)
在 Vercel 專案設定的 **Environment Variables** 中，為 **Production** 與 **Preview** 環境新增以下 2 個環境變數：

- **`DATABASE_URL`**：Supabase PostgreSQL Transaction Pooler 連線字串（例：`postgresql://postgres.xxxx:[密碼]@aws-0-xxxx.pooler.supabase.com:6543/postgres`）
- **`CWA_API_KEY`**：中央氣象署會員授權碼（例：`CWA-xxxxxxxx-xxxx-...`）

### 3. 自動部署驗證
- 點擊 **Deploy**，Vercel 將自動執行 production build 並產生公開網址。
- 未來每次對 `main` 分支執行 `git push`，Vercel 將自動觸發建置與更新上線。

## ☁️ 雲端資料庫設定 (Supabase PostgreSQL)

本專案支援雙模式資料庫（Dual-Database Mode）：
- **本機開發**：未設定 `DATABASE_URL` 時，自動使用本機 `data/weather.db` (SQLite)。
- **雲端部署**：設定 `DATABASE_URL` 時，自動透過連線池連線至 Supabase PostgreSQL。若在正式環境缺少 `DATABASE_URL`，系統將安全回傳 HTTP 503。

### 1. 建立 Supabase 資料表
1. 登入 [Supabase](https://supabase.com/) 並進入專案。
2. 開啟專案內的 [`scripts/init_supabase.sql`](scripts/init_supabase.sql)，在 Supabase **SQL Editor** 執行以建立資料表與 RLS 資安策略。
3. 在 Supabase **Project Settings -> Database -> Connection string** 選擇 **Transaction Pooler** (URI) 取得 `DATABASE_URL`。

### 2. 本機同步最新氣象資料至 Supabase
```bash
python scripts/refresh_supabase.py
```

## 🗺️ 台灣 GIS 互動地圖

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
  - 本地儲存：`data/taiwan-cities.geojson` 及 `public/data/taiwan-cities.geojson`

## 📊 天氣儀表板 UI

- **三大控制項**：縣市選擇器、預報日期選擇器、預報時段選擇器。
- **指標資訊卡 (TemperatureCards)**：即時呈現選定縣市與時段之最低溫、最高溫、平均溫、天氣現象與降雨機率。
- **溫度走勢折線圖 (TemperatureChart)**：使用 Recharts 呈現選定縣市 36 小時逐時段高低氣溫變化與繁體中文互動 Tooltip。
- **全台縣市預報總表 (ForecastTable)**：呈現選定時段下全台 22 縣市天氣指標，支援點擊切換縣市。
- **狀態防護**：具備載入中 Skeleton、API 錯誤重試提示及資料庫未初始化導引。

## 🐍 Python 本機 SQLite 資料管線

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

### 4. 抓取 CWA 最新預報並寫入 SQLite 資料庫 (Upsert)
```bash
python scripts/refresh_sqlite.py
```

## 📡 網站 API 規格

### 1. 取得指定日期全台天氣預報
- **端點**：`GET /api/weather?date=YYYY-MM-DD`
- **範例**：
  ```bash
  curl http://localhost:3000/api/weather?date=2026-09-22
  ```

### 2. 取得指定縣市所有預報時段
- **端點**：`GET /api/weather?city={縣市名稱}`
- **範例**：
  ```bash
  curl "http://localhost:3000/api/weather?city=臺北市"
  ```

## 🚀 前端本機啟動方式 (Local Development)

### 1. 安裝前端相依套件
```bash
npm install
```

### 2. 啟動開發伺服器
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
