# 台灣 CWA 天氣 GIS 儀表板

## 1. 專案目標

建立一個公開的台灣天氣預報網站，從中央氣象署（CWA）官方開放資料取得預報，整理後儲存至資料庫，並以互動式台灣 GIS 地圖、圖表與表格呈現各縣市氣溫。

使用者可以：

- 選擇預報日期與縣市。
- 查看最低溫、最高溫與平均溫。
- 透過台灣地圖比較各縣市溫度。
- 點擊地圖中的縣市查看詳細天氣資訊。

## 2. 作業需求對應

| 作業需求 | 專案做法 |
| --- | --- |
| CWA API | 由 Next.js 伺服器端安全呼叫 CWA 官方 API。 |
| 政府資料與資料庫 | Python 抓取、清理並寫入本機 SQLite。部署版使用雲端 PostgreSQL。 |
| GIS 網站 | 使用 Leaflet 與台灣縣市 GeoJSON 建立互動地圖。 |
| GitHub | 使用 Git 管理版本，推送至 GitHub。 |
| Vercel | GitHub 連接 Vercel，每次推送自動部署。 |

## 3. 系統架構

```text
CWA Open Data API
        ↓
Next.js API Route
        ↓
資料清理與統一格式
   ┌────┴────┐
   ↓         ↓
SQLite     PostgreSQL
本機學習    Vercel 公開網站
        ↓
Next.js 儀表板 + Leaflet GIS 地圖
        ↓
GitHub → Vercel 自動部署
```

## 4. 技術選擇

| 類別 | 技術 | 用途 |
| --- | --- | --- |
| 網站 | Next.js + TypeScript | 前端頁面與伺服器 API 路由 |
| 樣式 | Tailwind CSS | 響應式介面 |
| GIS | Leaflet + react-leaflet | 台灣地圖、縣市著色與 Popup |
| 圖表 | Recharts | 最低溫與最高溫趨勢圖 |
| 本機資料處理 | Python + requests + pandas + sqlite3 | 下載、清理、寫入 SQLite |
| 雲端資料庫 | Supabase PostgreSQL | Vercel 公開版的持久資料庫 |
| 版本與部署 | GitHub + Vercel | 原始碼管理與自動部署 |

## 5. CWA 資料來源

資料來自中央氣象署官方開放資料平台。

實作前必須確認目前有效的：

1. 預報資料集 ID 與 API URL。
2. API Key 的授權方式。
3. JSON 中縣市名稱、預報日期、`MinT`、`MaxT` 欄位位置。
4. 資料更新頻率與使用限制。

不可直接依賴舊教學的 API URL 或資料集 ID，必須以 CWA 官方目前文件為準。

## 6. 資料格式

無論 CWA 原始 JSON 長什麼樣子，都要先轉換為固定格式：

```json
{
  "city": "臺北市",
  "forecastDate": "2026-09-21",
  "minTemp": 25,
  "maxTemp": 32,
  "avgTemp": 28.5,
  "sourceUpdatedAt": "2026-09-21T06:00:00+08:00"
}
```

平均溫計算公式：

```text
avgTemp = (minTemp + maxTemp) / 2
```

## 7. 資料庫設計

SQLite 和 PostgreSQL 都使用相同概念的 `forecasts` 資料表。

```sql
CREATE TABLE forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  forecast_date TEXT NOT NULL,
  min_temp REAL NOT NULL,
  max_temp REAL NOT NULL,
  avg_temp REAL NOT NULL,
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(city, forecast_date)
);
```

同一縣市、同一預報日期只能保留一筆資料。資料更新時使用 upsert，避免重複插入。

SQLite 是本機學習與課程作業成果。Vercel 不適合長期寫入 SQLite，因此公開部署版使用 Supabase PostgreSQL。

## 8. GIS 地圖設計

使用公開授權的台灣縣市界線 GeoJSON。

需要建立縣市名稱對照，處理「台／臺」等名稱差異。例如：

| CWA 名稱 | GeoJSON 名稱 |
| --- | --- |
| 臺北市 | 臺北市 |
| 台中市 | 臺中市 |
| 台南市 | 臺南市 |

依平均溫度替地圖縣市著色：

| 平均溫度 | 顏色 |
| --- | --- |
| 小於 20°C | 藍色 |
| 20–24.9°C | 綠色 |
| 25–29.9°C | 黃色／橘色 |
| 大於等於 30°C | 紅色 |

點擊縣市時 Popup 顯示：

- 縣市名稱
- 預報日期
- 最低溫
- 最高溫
- 平均溫
- 資料更新時間

## 9. 網頁功能

首頁 `/` 必須包含：

1. 標題：台灣天氣 GIS 儀表板。
2. 日期選擇器。
3. 縣市選擇器。
4. 最低溫、最高溫、平均溫資訊卡。
5. 選定縣市的多日溫度折線圖。
6. 選定日期的全台 GIS 地圖。
7. 選定日期的全台資料表。

API 路由：

| 路徑 | 用途 |
| --- | --- |
| `GET /api/health` | 確認服務正常 |
| `GET /api/weather?date=YYYY-MM-DD` | 取得指定日期全台資料 |
| `GET /api/weather?city=臺北市` | 取得指定縣市多日資料 |
| `POST /api/admin/refresh` | 手動更新 CWA 資料，初期不可公開 |

## 10. 專案目錄

```text
taiwan-weather-gis/
├── app/
│   ├── api/
│   │   ├── health/route.ts
│   │   ├── weather/route.ts
│   │   └── admin/refresh/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── TaiwanMap.tsx
│   ├── TemperatureChart.tsx
│   ├── TemperatureCards.tsx
│   └── ForecastTable.tsx
├── lib/
│   ├── cwa.ts
│   ├── database.ts
│   ├── weather.ts
│   └── cityNames.ts
├── data/
│   └── taiwan-cities.geojson
├── scripts/
│   ├── fetch_cwa.py
│   ├── init_sqlite.py
│   └── refresh_sqlite.py
├── .env
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## 11. 環境變數與安全

本機使用 `.env`，其中已建立 CWA API Key：

```text
CWA_API_KEY=你的CWA授權碼
```

Next.js 只在伺服器端讀取：

```ts
const apiKey = process.env.CWA_API_KEY;
```

安全規則：

- `.env`、`.env.local`、`.vercel/` 必須加入 `.gitignore`。
- 不得在程式碼、README、截圖、commit 或 GitHub 顯示 API Key。
- 不得使用 `NEXT_PUBLIC_CWA_API_KEY`，因為它會暴露到瀏覽器。
- 只有伺服器端 API Route 可以讀取 `process.env.CWA_API_KEY`。
- 前端頁面只能呼叫 `/api/weather`，不可直接呼叫 CWA API。
- 缺少 `CWA_API_KEY` 時，回傳清楚錯誤訊息，但不得顯示密鑰。
- Vercel 要建立同名的 `CWA_API_KEY` 環境變數，並設定在 Development、Preview、Production。

## 12. 實作里程碑

### M0：建立骨架

- 建立 Next.js + TypeScript 專案。
- 建立首頁。
- 建立 `GET /api/health`。
- 建立 `.gitignore` 與 README。
- 驗收：首頁能開啟，`/api/health` 回傳 `{"status":"ok"}`。

### M1：探索 CWA API

- 從 `.env` 讀取 `CWA_API_KEY`。
- 請求一份 CWA 官方 JSON。
- 找出縣市、日期、最低溫與最高溫欄位。
- 驗收：可列印至少一個縣市的資料，且不輸出完整 API Key。

### M2：SQLite 資料管線

- 建立 `weather.db` 與 `forecasts` 表。
- 用 Python 將 CWA 資料清理後寫入 SQLite。
- 使用 upsert 避免資料重複。
- 驗收：可查詢指定縣市與日期。

### M3：網站 API

- 建立 CWA client。
- 實作 `/api/weather`。
- 只從伺服器端向 CWA 請求。
- 驗收：前端能讀取資料，API Key 不出現在瀏覽器。

### M4：儀表板

- 建立選擇器、溫度卡片、折線圖、資料表。
- 處理讀取中、無資料與 API 失敗狀態。
- 驗收：切換日期或縣市時，畫面同步更新。

### M5：GIS 地圖

- 載入台灣縣市 GeoJSON。
- 根據平均溫度著色。
- 點擊縣市顯示 Popup。
- 驗收：互動地圖資料正確。

### M6：雲端資料庫

- 建立 Supabase PostgreSQL。
- 建立 `forecasts` 表。
- 部署版改由雲端資料庫讀寫。
- 驗收：網站重新部署後資料仍存在。

### M7：GitHub 與 Vercel

- 推送程式到 GitHub。
- 在 Vercel 匯入 repository。
- 設定 `CWA_API_KEY` 和 `DATABASE_URL`。
- 驗收：分支有 Preview 網址，推送 `main` 後正式網站自動更新。

## 13. Git 與自動部署

每完成一項功能建立一次 commit：

```text
chore: initialize Next.js project
feat: add CWA weather normalizer
feat: save forecasts to SQLite
feat: add Taiwan temperature map
feat: add dashboard chart and table
docs: add setup and deployment guide
```

部署流程：

```text
本機修改
  ↓
git commit + git push
  ↓
GitHub repository 更新
  ↓
Vercel 自動建置
  ├── 分支：Preview 網址
  └── main：正式網站
```

## 14. Antigravity 工作規則

每次只實作一個里程碑。完成後必須：

1. 說明簡短實作計畫。
2. 只修改該里程碑需要的檔案。
3. 執行 lint、測試或 production build。
4. 列出修改的檔案與測試結果。
5. 不得讀取、輸出、修改或提交 `.env` 檔案。
6. 不得產生假裝是真實 CWA 資料的內容。

## 15. 第一個 Antigravity Prompt

```text
請閱讀 design.md，只實作 M0：建立骨架。

需求：
1. 建立 Next.js + TypeScript 專案。
2. 首頁顯示「台灣天氣 GIS 儀表板」。
3. 建立 GET /api/health，回傳 { "status": "ok" }。
4. 建立 .gitignore，確認 .env 不會被 Git 追蹤。
5. 更新 README，說明本機啟動與測試方式。
6. 不要建立資料庫、CWA API、GIS 地圖、假資料或 Vercel 設定。
7. 完成後執行 lint 與 production build，回報結果。
```

## 16. 完成條件

- [ ] 安全從 CWA API 取得真實資料。
- [ ] Python 可將資料寫入 SQLite。
- [ ] 網頁可顯示溫度卡片、圖表和資料表。
- [ ] 台灣 GIS 地圖可依溫度著色並顯示詳細資料。
- [ ] GitHub 不含任何 API Key 或機密資料。
- [ ] GitHub 更新會自動觸發 Vercel 部署。
- [ ] 公開網站網址可正常使用。