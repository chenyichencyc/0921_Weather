# 🌤️ 台灣天氣預報 GIS 儀表板 (Taiwan Weather Forecast)

> **AI 創新微課程實作專案**：從中央氣象署 (CWA) 開放資料、JSON 解析、Pandas 資料清理、SQLite 資料庫設計，到 Streamlit 與 Next.js 互動式天氣預報 GIS 儀表板。

### 🔗 專案重要連結
- 🌐 **線上正式版網站 (Vercel)**：[https://0921-weather.vercel.app](https://0921-weather.vercel.app)
- 📦 **GitHub 專案原始碼**：[https://github.com/chenyichencyc/0921_Weather](https://github.com/chenyichencyc/0921_Weather)

---

## 🗺️ 課程流程對照表 (24 步驟完整實作)

本專案完全遵循**「AI 創新微課程：從氣象資料到互動式天氣預報應用」**之 24 個學習地圖流程：

| 階段 | 步驟 | 主題與實作項目 | 專案對應程式與實作方式 |
| :--- | :---: | :--- | :--- |
| **一、資料取得** | **01-02** | 課程介紹與台灣生活氣象的重要性 | 確立專案目標：全台 22 縣市氣象可視化 |
| | **03** | 中央氣象署 (CWA) Open Data 平台 | 取得 CWA API Key，選擇官方預報資料集 |
| | **04** | API 資料取得 (Requests) | `requests.get()` 取得 CWA 官方最新 JSON 預報資料 |
| **二、資料處理** | **05** | JSON 資料結構解析 | 定位 `locationName` 與 `weatherElement` (MinT, MaxT, Wx, PoP) |
| | **06** | 提取最高與最低氣溫 | 解析時間序列時段，提取最高溫與最低溫數值 |
| | **07** | 資料整理與預覽 (Pandas) | 使用 `pd.DataFrame` 整理為結構化表格、型別轉換與清理 |
| **三、資料庫設計** | **08** | 建立 SQLite 資料庫 | 建立本地資料庫 `data/weather.db` (相容 `data.db`) |
| | **09** | 資料庫設計 (`TemperatureForecasts`) | 建立包含 `regionName`, `dataDate`, `minT`, `maxT` 之資料結構 |
| | **10** | 查詢資料驗證 (SQL) | 執行 `SELECT DISTINCT regionName...` 驗證資料入庫 |
| **四、Web App 實作** | **11** | Streamlit 入門與環境建置 | 建立 `streamlit_app.py` 應用架構 |
| | **12** | 從資料庫讀取資料 | `pd.read_sql_query()` 自 SQLite 即時查詢預報紀錄 |
| | **13** | 下拉選單選擇地區 | 實作側邊欄 `st.selectbox` 互動選擇 22 縣市與日期 |
| | **14** | 繪製氣溫折線圖 | `st.line_chart` 視覺化呈現各時段最高與最低氣溫走勢 |
| | **15** | 顯示資料表格 | `st.dataframe` 結構化清晰呈現預報數據 |
| | **16** | 整合 Web App 介面 | 聯動選單、指標卡 (Metrics)、圖表與表格於單一儀表板 |
| **五、GIS 地圖視覺化** | **17** | 台灣地圖視覺化 (Folium) | 載入 GeoJSON 向量邊界，依氣溫四色階填色 (<20°C 藍, 20-25°C 綠, 25-30°C 橘, >30°C 紅) |
| | **18** | 選擇日期顯示地圖 | 依選取時段動態著色地圖，支援點擊縣市 Popup 氣溫氣象 |
| | **19** | 完整成果展示 | `streamlit-folium` 嵌入互動 GIS 地圖完成完整 Dashboard |
| **六、優化與延伸** | **20** | 程式碼品質與優化 | 模組化設計、例外處理機制、SQLite `ON CONFLICT` 防重複插入 |
| | **21** | 專案上傳至 GitHub | Git 版本控制、Commit & Push 至遠端儲存庫 |
| | **22** | 延伸應用與擴充 | 延伸實作 Next.js 15 全球公開網站部署至 Vercel，支援 Supabase 備援 |
| | **23-24** | 回顧總結與未來探索 | 整合 API × JSON × Python × SQLite × Streamlit × Web GIS |

---

## 🔄 系統資料運作流程

```text
[ 1. 中央氣象署 (CWA API) ]
              │
              ▼ (requests 取得 JSON 原始資料)
[ 2. Pandas 資料清理與正規化 ] 
              │
              ▼ (寫入 / Upsert 避免重複插入)
[ 3. SQLite 本地資料庫 (data/weather.db / data.db) ]
              │
              ├──────────────────────────────┐
              ▼                              ▼
[ 4. 課程展示版 (Streamlit + Folium) ]    [ 5. 線上正式版 (Next.js + Leaflet) ]
 - 縣市 / 日期下拉互動選單                 - Vercel 全球 CDN 自動部署
 - 氣溫色階台灣 GIS 地圖                   - CWA-first 5 分鐘記憶體快取
 - 最高溫 / 最低溫趨勢折線圖               - 未來一週 7~8 天全台預報
 - 結構化天氣預報總表                      - 響應式現代化 UI 介面
```

---

## 🗄️ 雙資料庫分工與 Supabase 角色定位

本專案同時採用 **SQLite** 與 **Supabase (PostgreSQL)** 雙資料庫架構，各司其職且互為互補：

| 資料庫 | 應用環境 | 定位與核心任務 | 運作機制 |
| :--- | :--- | :--- | :--- |
| **SQLite**<br>(`data/weather.db` / `data.db`) | **本機端**<br>Python / Streamlit 課程版 | **課程作業標準實作**<br>(海報步驟 8～12) | 供 Python 腳本清洗資料後寫入，並由 Streamlit 透過 SQL 直接查詢視覺化。 |
| **Supabase**<br>(PostgreSQL) | **雲端生產環境**<br>Next.js / Vercel 正式版 | **雲端備份與斷線高可用備援**<br>(Failover Fallback) | 平時由後端背景非阻塞寫入備份；若 CWA 官方 API 遭遇維護或限流斷線，自動降級改讀 Supabase，確保線上網站永不掛掉。 |

> 💡 **為什麼線上網站平時優先顯示 CWA 即時資料？**  
> 氣象預報高度講求即時性。本專案採用 **CWA-First（官方優先）** 設計：平時確保使用者看見當下最新的一手數值，並於背景非阻塞同步至 Supabase 儲存庫；Supabase 作為「強健後盾」，消除了單點故障風險，兼顧**資料即時性**與**高可用性 (High Availability)**。

---

## 🚀 快速啟動流程 (Quick Start)

### 方案 A：課程標準版 (Python + Streamlit + SQLite)
遵循海報步驟 8～19 啟動本機儀表板：

```bash
# 1. 建立虛擬環境並安裝套件
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. 初始化 SQLite 資料庫並抓取最新氣象資料 (步驟 8-10)
python scripts/init_sqlite.py
python scripts/refresh_sqlite.py

# 3. 啟動 Streamlit 互動式天氣 Web App (步驟 11-19)
streamlit run streamlit_app.py
```
啟動後於瀏覽器開啟 [http://localhost:8501](http://localhost:8501)。

---

### 方案 B：線上生產版 (Next.js + React + Leaflet GIS)
海報步驟 22 延伸成果：

```bash
# 1. 安裝前端相依套件
npm install

# 2. 設定環境變數 (.env 填入 CWA_API_KEY)
cp .env.example .env

# 3. 啟動開發伺服器
npm run dev
```
瀏覽器開啟 [http://localhost:3000](http://localhost:3000)。

---

## 🧪 資料庫設計與 SQL 驗證 (步驟 09-10)

資料庫內建相容視圖 `TemperatureForecasts`，支援標準 SQL 查詢：

```sql
-- 檢查支援之地區/縣市清單
SELECT DISTINCT regionName FROM TemperatureForecasts;

-- 查詢特定地區之預報數據 (最低溫、最高溫)
SELECT regionName, dataDate, minT, maxT, weather_description
FROM TemperatureForecasts
WHERE regionName = '臺北市'
ORDER BY dataDate ASC;
```

---

## 🔑 環境變數設定

| 變數名稱 | 必填 | 用途說明 |
| :--- | :---: | :--- |
| `CWA_API_KEY` | **是** | 中央氣象署開放資料平台授權碼（會員 API Key） |
| `DATABASE_URL` | 否 | Supabase PostgreSQL 連線字串（正式線上版備援快取） |

---

## 📄 專案說明與致謝
- **課程**：AI 創新微課程 Taiwan Weather Forecast
- **指導**：煥哥（AI × Coding 實作流程）
- **氣象資料來源**：[交通部中央氣象署開放資料平台 (CWA Open Data)](https://opendata.cwa.gov.tw/)
