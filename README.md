# 🌤️ 台灣天氣 GIS 儀表板 (0921_Weather)

> 整合中央氣象署 (CWA) 官方開放資料，提供全台 22 縣市未來一週即時天氣預報、GIS 互動地圖與氣溫走勢儀表板。

### 🔗 相關連結
- 🌐 **線上展示網站**：[https://0921-weather.vercel.app](https://0921-weather.vercel.app)
- 📦 **GitHub 專案原始碼**：[https://github.com/chenyichencyc/0921_Weather](https://github.com/chenyichencyc/0921_Weather)

---

## 🔄 系統運作流程

```text
[ 使用者瀏覽器 ]
       │
       ▼ (1. 查詢縣市/日期)
[ Next.js API 路由 (/api/weather) ]
       │
       ├─► (2. 快取未過期) ──► 立即回傳記憶體快取 (5 分鐘)
       │
       ▼ (3. 快取過期 / 首次呼叫)
[ 中央氣象署 CWA 官方 API (F-D0047-091) ]
       │
       ├─► [成功] ──► 解析未來一週 (7-8天) 預報資料 ──► 回傳前端渲染
       │                 └─► (背景非同步備份至 Supabase / SQLite)
       │
       └─► [斷線/異常] ──► 容錯讀取資料庫備份快取 (Fallback)
```

---

## ✨ 核心特色功能

1. **🗺️ 互動式 GIS 台灣地圖**：採用 Leaflet + GeoJSON 向量圖層，依氣溫自動著色，支援點擊縣市即時切換。
2. **📅 未來一週 (7～8 天) 完整預報**：介接 CWA `F-D0047-091` 一週預報資料集，支援依日期與白天/夜間時段動態篩選。
3. **📈 氣溫走勢圖表**：以 Recharts 繪製各時段最低溫與最高溫變化趨勢。
4. **📋 全台預報總表**：整併 22 縣市氣溫、天氣現象與降雨機率，支援快速點擊瀏覽。
5. **🛡️ 雙版本與高可用架構**：Next.js 正式網站（CWA-First 即時連線）+ 課程相容版（Python + Streamlit + Folium）。

---

## 🚀 本地快速啟動流程 (Quick Start)

### 1. 正式版：Next.js Web App

```bash
# 1. 複製專案並安裝相依套件
git clone https://github.com/chenyichencyc/0921_Weather.git
cd 0921_Weather
npm install

# 2. 設定環境變數 (.env)
cp .env.example .env
# 請在 .env 中填入你的 CWA_API_KEY

# 3. 啟動開發伺服器
npm run dev
```
瀏覽器開啟 [http://localhost:3000](http://localhost:3000) 即可瀏覽。

---

### 2. 課程展示版：Python Streamlit App (選用)

```bash
# 建立虛擬環境並安裝相依套件
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 初始化 SQLite 並同步氣象資料
python scripts/init_sqlite.py
python scripts/refresh_sqlite.py

# 啟動 Streamlit
streamlit run streamlit_app.py
```
瀏覽器開啟 [http://localhost:8501](http://localhost:8501) 即可檢視。

---

## 🔑 環境變數說明

| 變數名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| `CWA_API_KEY` | **是** | 中央氣象署開放資料平台會員授權碼（僅由伺服器端存取） |
| `DATABASE_URL` | 否 | Supabase PostgreSQL 連線字串（作為離線備援快取） |

---

## 📄 專案說明
- 本專案為人工智慧與資訊安全課程作業與技術展示用途。
- 天氣資料來源：[交通部中央氣象署開放資料平台](https://opendata.cwa.gov.tw/)。
