# 台灣 CWA 天氣 GIS 儀表板 (0921_Weather)

台灣天氣預報 GIS 儀表板，整合中央氣象署 (CWA) 開放資料、SQLite/PostgreSQL 資料庫與 Leaflet 地圖呈現。

## 🌤️ 專案簡介 (Milestone 0: 專案骨架)

本專案使用 Next.js (App Router) + TypeScript + Tailwind CSS 建立。

## 🚀 本機啟動方式 (Local Development)

### 1. 安裝相依套件
```bash
npm install
```

### 2. 環境變數設定
複製範本檔案並填入你的 CWA API Key：
```bash
cp .env.example .env
```
編輯 `.env`：
```env
CWA_API_KEY=你的CWA授權碼
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
