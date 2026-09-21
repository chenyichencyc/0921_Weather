import fs from "fs";
import path from "path";

// 讀取 .env 中的 CWA_API_KEY，不印出金鑰內容
function getApiKey() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env 檔案不存在，請先建立 .env 並設定 CWA_API_KEY");
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/^CWA_API_KEY\s*=\s*(.+)$/m);
  if (!match || !match[1].trim()) {
    throw new Error("在 .env 中未找到有效的 CWA_API_KEY");
  }
  return match[1].trim().replace(/^["']|["']$/g, "");
}

async function inspectCwa() {
  const apiKey = getApiKey();
  const datasetId = "F-C0032-001"; // 中央氣象署：一般天氣預報-今明36小時天氣預報
  const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${datasetId}?Authorization=${apiKey}`;

  console.log("=== 中央氣象署 (CWA) API 結構驗證 ===");
  console.log(`資料集 ID: ${datasetId}`);

  try {
    const res = await fetch(url);
    console.log(`HTTP 狀態碼: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      console.error(`請求失敗，狀態碼: ${res.status}`);
      process.exit(1);
    }

    const data = await res.json();

    if (!data.success || !data.records || !data.records.location) {
      console.error("回傳格式異常：找不到 records.location 結構");
      console.log("頂層屬性:", Object.keys(data));
      process.exit(1);
    }

    const locations = data.records.location;
    console.log(`取得縣市總數: ${locations.length} 個縣市`);

    // 取第一筆縣市作為範例驗證
    const firstLocation = locations[0];
    const locationName = firstLocation.locationName;
    console.log(`範例縣市名稱: ${locationName}`);

    // 尋找天氣要素 MinT (最低溫) 與 MaxT (最高溫)
    const elements = firstLocation.weatherElement || [];
    const minTElement = elements.find((el) => el.elementName === "MinT");
    const maxTElement = elements.find((el) => el.elementName === "MaxT");
    const wxElement = elements.find((el) => el.elementName === "Wx");
    const popElement = elements.find((el) => el.elementName === "PoP");

    if (!minTElement || !maxTElement) {
      console.error("未能找到 MinT 或 MaxT 天氣要素");
      console.log(
        "可用要素:",
        elements.map((el) => el.elementName)
      );
      process.exit(1);
    }

    const firstMinTime = minTElement.time?.[0];
    const firstMaxTime = maxTElement.time?.[0];

    const startTime = firstMinTime?.startTime || "無資料";
    const endTime = firstMinTime?.endTime || "無資料";
    const minTemp = firstMinTime?.parameter?.parameterName || "無資料";
    const minUnit = firstMinTime?.parameter?.parameterUnit || "C";
    const maxTemp = firstMaxTime?.parameter?.parameterName || "無資料";
    const maxUnit = firstMaxTime?.parameter?.parameterUnit || "C";

    console.log(`預報時段: ${startTime} ~ ${endTime}`);
    console.log(`最低溫 (MinT): ${minTemp} °${minUnit}`);
    console.log(`最高溫 (MaxT): ${maxTemp} °${maxUnit}`);
    if (wxElement?.time?.[0]) {
      console.log(`天氣現象 (Wx): ${wxElement.time[0].parameter?.parameterName}`);
    }
    if (popElement?.time?.[0]) {
      console.log(`降雨機率 (PoP): ${popElement.time[0].parameter?.parameterName}%`);
    }

    console.log("\n=== 驗證之 JSON 欄位路徑 ===");
    console.log("1. 縣市列表: records.location[]");
    console.log("2. 縣市名稱: records.location[].locationName");
    console.log("3. 天氣要素陣列: records.location[].weatherElement[]");
    console.log("4. 要素名稱代碼: records.location[].weatherElement[].elementName (例如: 'MinT', 'MaxT', 'Wx', 'PoP')");
    console.log("5. 預報時段: records.location[].weatherElement[].time[]");
    console.log("6. 開始時間: records.location[].weatherElement[].time[].startTime");
    console.log("7. 結束時間: records.location[].weatherElement[].time[].endTime");
    console.log("8. 溫度數值: records.location[].weatherElement[].time[].parameter.parameterName");
    console.log("9. 溫度單位: records.location[].weatherElement[].time[].parameter.parameterUnit");
    console.log("\n 驗證通過：CWA API 連線正常，資料結構與解析路徑吻合！");
  } catch (err) {
    // 遮蔽可能的 key 訊息
    const safeMsg = err.message ? err.message.replace(/Authorization=[^&]*/g, "Authorization=[REDACTED]") : "未知錯誤";
    console.error(`執行時發生錯誤: ${safeMsg}`);
    process.exit(1);
  }
}

inspectCwa();
