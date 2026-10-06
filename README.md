# 台灣 CWA 天氣 GIS 儀表板 (0921_Weather)

台灣天氣預報 GIS 儀表板，整合中央氣象署 (CWA) 開放資料、SQLite/PostgreSQL 資料庫、Leaflet 互動地圖與 Streamlit 課程展示版。

## 🌤️ 專案簡介與雙版本架構

本專案採用雙架構設計，兼顧正式生產環境公開部署與課程技術展示需求：

1. **正式公開網站（Production Web App）**：
   - **技術棧**：Next.js (App Router) + TypeScript + Tailwind CSS + Leaflet GIS 地圖 + Recharts 圖表。
   - **部署平台**：Vercel 自動化 CI/CD。
   - **資料架構（CWA-first 直接優先）**：中央氣象署 (CWA) 官方 API 為即時第一手資料來源；Supabase PostgreSQL 為可選歷史資料保存與離線備援快取。
2. **課程技術相容版（Course Demo App）**：
   - **技術棧**：Python + Pandas + SQLite + Streamlit + Folium。
   - **用途**：符合課程作業技術要求（Python/Pandas/SQLite/Streamlit/Folium），供本機教學展示與 Streamlit Community Cloud 展示，不影響 Next.js 正式網站。

## ⚡ CWA-first 核心資料架構設計

本專案 API 路由 `/api/weather` 採用 **「CWA 直接優先、Supabase 非必要」** 架構：

```text
                  使用者前端請求 (/api/weather)
                              │
                    ┌─────────▼─────────┐
                    │ 5 分鐘記憶體快取? │──(命中)──> 回傳 { source: "cwa" }
                    └─────────┬─────────┘
                           (未命中)
                              │
                    ┌─────────▼─────────┐
                    │ CWA 官方 API 請求 │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
           (成功)                           (失敗)
              │                               │
    ┌─────────▼─────────┐           ┌─────────▼─────────┐
    │  正規化預報資料   │           │ 資料庫備援查詢    │
    │  (source: "cwa")  │           │ (Supabase/SQLite) │
    └─────────┬─────────┘           └─────────┬─────────┘
              │                               │
    ┌─────────┴─────────┐             ┌───────┴───────┐
    │                   │          (成功)           (失敗)
┌───▼───┐       ┌───────▼───────┐     │               │
│ 回傳  │       │ Best-Effort   │  ┌──▼──┐        ┌───▼───┐
│ 前端  │       │ Supabase 寫入 │  │回傳 │        │ HTTP  │
└───────┘       │ (失敗不影響)  │  │前端 │        │  503  │
                └───────────────┘  └─────┘        └───────┘
```

- **CWA 直接優先**：每次請求時，伺服器端優先向 CWA API 請求最新預報並寫入單一 Instance 5 分鐘記憶體快取。
- **即時回傳與 Best-effort Upsert**：取得 CWA 資料後立刻回應前端；同時對 Supabase 進行非阻塞/短逾時之 Best-effort 寫入。即使 Supabase 離線或寫入失敗，API 依然成功回傳 CWA 資料（`source: "cwa"`）。
- **失敗備援（Fallback Cache）**：僅當 CWA 服務暫時無法連線時，才嘗試讀取 Supabase（本機環境支援 SQLite）之最後成功備份資料（`source: "database-cache"`）。
- **環境隔離**：在 Vercel / Production 環境，絕不讀取或回退至本機 SQLite（SQLite 僅限本機開發）。
- **高可用性**：只有當 CWA 與資料庫備援皆無法提供資料時，才回傳 HTTP 503。

## 🔑 環境變數設定

正式部署與伺服器端運作所需之環境變數如下：

1. **`DATABASE_URL`**：Supabase PostgreSQL Transaction Pooler URI（值以 `postgresql://` 開頭），供伺服器端連線雲端資料庫（可選，未設定時仍可直接由 CWA 取得即時資料）。
2. **`CWA_API_KEY`**：中央氣象署開放資料平台會員授權碼（API Key），僅供 Next.js 伺服器端向 CWA 官方 API 請求最新預報資料。

> ⚠️ **資安防護規範**：
> - 所有機密變數僅供後端伺服器存取，絕不透過 `NEXT_PUBLIC_` 暴露至瀏覽器前端。
> - `.env` 與 `.env*.local` 已加入 `.gitignore`，不得提交至 Git 或公開儲存庫。

## 🚀 GitHub 與 Vercel 自動部署

本專案支援 Vercel CI/CD 自動部署流程：

### 1. 在 Vercel 匯入 GitHub Repository
1. 登入 [Vercel](https://vercel.com/)。
2. 點擊 **Add New... -> Project**，匯入 `chenyichencyc/0921_Weather`。
3. Framework Preset 選擇 **Next.js**，Root Directory 選擇 `./`。

### 2. 設定 Vercel 環境變數 (Environment Variables)
在 Vercel 專案設定的 **Environment Variables** 中，為 **Production** 與 **Preview** 環境新增以下環境變數：
- **`CWA_API_KEY`**：中央氣象署會員授權碼（例：`CWA-xxxxxxxx-xxxx-...`）
- **`DATABASE_URL`**：（可選）Supabase PostgreSQL Transaction Pooler 連線字串（例：`postgresql://postgres.xxxx:[密碼]@aws-0-xxxx.pooler.supabase.com:6543/postgres`）

### 3. 自動部署驗證
- 點擊 **Deploy**，Vercel 將自動執行 production build 並產生公開網址。
- 未來每次對 `main` 分支執行 `git push`，Vercel 將自動觸發建置與更新上線。

## 🐍 課程相容 Streamlit 版本 (Python + Pandas + SQLite + Folium)

為完全滿足課程作業海報的技術要求，專案提供獨立的 Streamlit 本機展示版本。

### 1. 建立虛擬環境並安裝相依套件
```bash
python -m venv .venv
source .venv/bin/activate  # macOS / Linux
# 或 Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

### 2. 初始化 SQLite 資料庫並透過 Pandas 更新氣象資料
```bash
# 1. 建立 data/weather.db 與 forecasts 資料表
python scripts/init_sqlite.py

# 2. 透過 Pandas DataFrame 正規化 CWA 預報並 Upsert 寫入 SQLite
python scripts/refresh_sqlite.py
```

### 3. 啟動 Streamlit 互動儀表板
```bash
streamlit run streamlit_app.py
```
啟動後瀏覽器會自動開啟 [http://localhost:8501](http://localhost:8501)，功能包括：
- **側邊控制欄**：22 縣市下拉選單、預報日期與預報時段切換。
- **天氣資訊卡**：最低溫、最高溫、平均溫（含狀態標籤）、天氣現象、降雨機率。
- **Folium 互動 GIS 地圖**：以本地 `data/taiwan-cities.geojson` 繪製 22 縣市多邊形，依平均氣溫填色，支援 Hover Tooltip 與 Click Popup 氣象資訊。
- **氣溫走勢圖**：選定縣市 36 小時氣溫變化折線圖。
- **全台預報總表**：Pandas 結構化全台縣市預報總表。

## 📡 網站 API 規格

### 1. 取得指定日期全台天氣預報
- **端點**：`GET /api/weather?date=YYYY-MM-DD`
- **範例**：
  ```bash
  curl http://localhost:3000/api/weather?date=2026-10-07
  ```
- **回應範例**：
  ```json
  {
    "source": "cwa",
    "count": 66,
    "data": [ ... ]
  }
  ```

### 2. 取得指定縣市所有預報時段
- **端點**：`GET /api/weather?city={縣市名稱}`
- **範例**：
  ```bash
  curl "http://localhost:3000/api/weather?city=臺北市"
  ```
- **回應範例**：
  ```json
  {
    "source": "cwa",
    "count": 3,
    "data": [
      {
        "id": 1,
        "city": "臺北市",
        "forecastStart": "2026-10-07 00:00:00",
        "forecastEnd": "2026-10-07 06:00:00",
        "forecastDate": "2026-10-07",
        "minTemp": 22,
        "maxTemp": 22,
        "avgTemp": 22,
        "weatherDescription": "多雲",
        "rainProbability": 10,
        "sourceUpdatedAt": "2026-10-06T16:45:29.331Z",
        "createdAt": "2026-10-06T16:45:29.331Z"
      }
    ]
  }
  ```

## 🚀 前端本機啟動方式 (Next.js Local Development)

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
本專案為人工智慧與資訊安全課程作業與技術展示用途。

