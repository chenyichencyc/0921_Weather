/**
 * 縣市名稱正規化與地圖色彩輔助模組
 */

/**
 * 將各種來源的台灣縣市名稱正規化為標準 CWA 官方名稱 (例如：統一為「臺」字，桃園縣轉為桃園市)
 */
export function normalizeCityName(name: string): string {
  if (!name) return "";
  let normalized = name.trim();

  // 處理 桃園縣 -> 桃園市 (2014年改制)
  if (normalized === "桃園縣") {
    normalized = "桃園市";
  }

  // 統一「台」為「臺」
  normalized = normalized.replace(/^台/, "臺");

  return normalized;
}

/**
 * 依據平均溫度 (avgTemp) 回傳對應的地圖多邊形填色代碼
 * 規則：
 * - < 20°C: 藍色 (#3b82f6)
 * - 20–24.9°C: 綠色 (#10b981)
 * - 25–29.9°C: 黃色/橘色 (#f59e0b)
 * - >= 30°C: 紅色 (#ef4444)
 * - 無資料 / 無法匹配: 灰色 (#94a3b8)
 */
export function getTemperatureColor(avgTemp: number | undefined | null): string {
  if (avgTemp === undefined || avgTemp === null || isNaN(avgTemp)) {
    return "#94a3b8"; // 灰色
  }
  if (avgTemp < 20) {
    return "#3b82f6"; // 藍色
  }
  if (avgTemp < 25) {
    return "#10b981"; // 綠色
  }
  if (avgTemp < 30) {
    return "#f59e0b"; // 橘黃色
  }
  return "#ef4444"; // 紅色
}

/**
 * 取得溫度等級文字說明
 */
export function getTemperatureLevelLabel(avgTemp: number | undefined | null): string {
  if (avgTemp === undefined || avgTemp === null || isNaN(avgTemp)) {
    return "無資料";
  }
  if (avgTemp < 20) return "偏涼 (< 20°C)";
  if (avgTemp < 25) return "舒適 (20–24.9°C)";
  if (avgTemp < 30) return "溫暖 (25–29.9°C)";
  return "炎熱 (≥ 30°C)";
}
