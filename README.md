# 台灣 CWA 天氣 GIS 儀表板 (0921_Weather)

台灣天氣預報 GIS 儀表板，整合中央氣象署 (CWA) 開放資料、SQLite/PostgreSQL 資料庫與 Leaflet 地圖呈現。

## 🌤️ 專案簡介

本專案使用 Next.js (App Router) + TypeScript + Tailwind CSS 建立前端與 API，並搭配 Python 腳本建立本機 SQLite 天氣資料管線。

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
