const CWA_WEEKLY_DATASET_ID = "F-D0047-091"; // 臺灣各縣市未來1週 (7天) 天氣預報
const CWA_36H_DATASET_ID = "F-C0032-001";    // 一般天氣預報 (今明 36 小時備援)

export interface ParsedCwaRecord {
  city: string;
  forecastStart: string;
  forecastEnd: string;
  forecastDate: string;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  weatherDescription: string;
  rainProbability: number | null;
  sourceUpdatedAt: string;
}

interface CwaWeeklyValue {
  MinTemperature?: string;
  MaxTemperature?: string;
  Temperature?: string;
  ProbabilityOfPrecipitation?: string;
  Weather?: string;
  WeatherCode?: string;
  WeatherDescription?: string;
}

interface CwaWeeklyTime {
  StartTime?: string;
  EndTime?: string;
  ElementValue?: CwaWeeklyValue[];
  startTime?: string;
  endTime?: string;
  elementValue?: CwaWeeklyValue[];
}

interface CwaWeeklyElement {
  ElementName?: string;
  elementName?: string;
  Time?: CwaWeeklyTime[];
  time?: CwaWeeklyTime[];
}

interface CwaWeeklyLocation {
  LocationName?: string;
  locationName?: string;
  WeatherElement?: CwaWeeklyElement[];
  weatherElement?: CwaWeeklyElement[];
}

interface CwaWeeklyLocations {
  Location?: CwaWeeklyLocation[];
  location?: CwaWeeklyLocation[];
}

interface CwaWeeklyResponse {
  success?: string | boolean;
  records?: {
    Locations?: CwaWeeklyLocations[];
    locations?: CwaWeeklyLocations[];
  };
}

interface Cwa36hTimeEntry {
  startTime?: string;
  endTime?: string;
  parameter?: {
    parameterName?: string;
    parameterValue?: string;
    parameterUnit?: string;
  };
}

interface Cwa36hElement {
  elementName?: string;
  time?: Cwa36hTimeEntry[];
}

interface Cwa36hLocation {
  locationName?: string;
  weatherElement?: Cwa36hElement[];
}

interface Cwa36hResponse {
  success?: string | boolean;
  records?: {
    location?: Cwa36hLocation[];
  };
}

/**
 * 將 ISO 時間字串正規化為 YYYY-MM-DD HH:mm:ss 格式
 * 例如 "2026-10-11T18:00:00+08:00" -> "2026-10-11 18:00:00"
 */
function normalizeTimeString(raw: string): string {
  if (!raw) return "";
  if (raw.includes("T")) {
    return raw.slice(0, 19).replace("T", " ");
  }
  return raw;
}

/**
 * 解析 CWA F-D0047-091 (未來 1 週 / 7天以上各縣市天氣預報)
 */
function parseWeeklyForecasts(json: CwaWeeklyResponse): ParsedCwaRecord[] {
  const records = json?.records;
  const locationsArray = records?.Locations || records?.locations;
  if (!locationsArray || !Array.isArray(locationsArray) || locationsArray.length === 0) {
    return [];
  }

  const locationList = locationsArray[0]?.Location || locationsArray[0]?.location;
  if (!locationList || !Array.isArray(locationList)) {
    return [];
  }

  const recordsList: ParsedCwaRecord[] = [];
  const sourceUpdatedAt = new Date().toISOString();

  for (const loc of locationList) {
    const city = (loc.LocationName || loc.locationName || "").trim();
    if (!city) continue;

    const weatherElements = loc.WeatherElement || loc.weatherElement || [];
    const elementMap: Record<string, Record<string, { endTime: string; value: CwaWeeklyValue }>> = {};

    for (const el of weatherElements) {
      const elName = el.ElementName || el.elementName;
      if (!elName) continue;

      const timeMap: Record<string, { endTime: string; value: CwaWeeklyValue }> = {};
      const times = el.Time || el.time || [];
      for (const t of times) {
        const startTime = t.StartTime || t.startTime;
        const endTime = t.EndTime || t.endTime;
        const valObj = (t.ElementValue && t.ElementValue[0]) || (t.elementValue && t.elementValue[0]) || {};
        if (startTime) {
          timeMap[startTime] = {
            endTime: endTime || "",
            value: valObj,
          };
        }
      }
      elementMap[elName] = timeMap;
    }

    const minTMap = elementMap["最低溫度"] || {};
    const maxTMap = elementMap["最高溫度"] || {};
    const avgTMap = elementMap["平均溫度"] || {};
    const popMap = elementMap["12小時降雨機率"] || {};
    const wxMap = elementMap["天氣現象"] || {};

    const allStartTimes = Array.from(
      new Set([...Object.keys(minTMap), ...Object.keys(maxTMap), ...Object.keys(wxMap)])
    ).sort();

    for (const rawStart of allStartTimes) {
      const minEntry = minTMap[rawStart];
      const maxEntry = maxTMap[rawStart];
      const avgEntry = avgTMap[rawStart];
      const popEntry = popMap[rawStart];
      const wxEntry = wxMap[rawStart];

      const rawEnd = minEntry?.endTime || maxEntry?.endTime || wxEntry?.endTime || "";
      if (!rawEnd) continue;

      const forecastStart = normalizeTimeString(rawStart);
      const forecastEnd = normalizeTimeString(rawEnd);
      const forecastDate = forecastStart.slice(0, 10);

      const minValStr = minEntry?.value?.MinTemperature;
      const maxValStr = maxEntry?.value?.MaxTemperature;
      const avgValStr = avgEntry?.value?.Temperature;

      const minVal = parseFloat(minValStr || "0");
      const maxVal = parseFloat(maxValStr || "0");
      if (isNaN(minVal) || isNaN(maxVal)) continue;

      let avgVal = avgValStr ? parseFloat(avgValStr) : NaN;
      if (isNaN(avgVal)) {
        avgVal = Math.round(((minVal + maxVal) / 2.0) * 10) / 10;
      }

      const weatherDescription = wxEntry?.value?.Weather || "";
      const popStr = popEntry?.value?.ProbabilityOfPrecipitation;
      const rainProbability = popStr && /^\d+$/.test(popStr.trim()) ? parseInt(popStr.trim(), 10) : null;

      recordsList.push({
        city,
        forecastStart,
        forecastEnd,
        forecastDate,
        minTemp: minVal,
        maxTemp: maxVal,
        avgTemp: avgVal,
        weatherDescription,
        rainProbability,
        sourceUpdatedAt,
      });
    }
  }

  return recordsList;
}

/**
 * 解析 CWA F-C0032-001 (備援：今明 36 小時預報)
 */
function parse36hForecasts(json: Cwa36hResponse): ParsedCwaRecord[] {
  if (!json?.records?.location) return [];

  const recordsList: ParsedCwaRecord[] = [];
  const sourceUpdatedAt = new Date().toISOString();

  for (const loc of json.records.location) {
    const city = loc.locationName?.trim();
    if (!city) continue;

    const elementsMap: Record<string, Record<string, Cwa36hTimeEntry>> = {};
    for (const el of loc.weatherElement || []) {
      const timeMap: Record<string, Cwa36hTimeEntry> = {};
      const elName = el.elementName;
      if (!elName) continue;
      for (const t of el.time || []) {
        if (t.startTime) {
          timeMap[t.startTime] = t;
        }
      }
      elementsMap[elName] = timeMap;
    }

    const minTMap = elementsMap["MinT"] || {};
    const maxTMap = elementsMap["MaxT"] || {};
    const wxMap = elementsMap["Wx"] || {};
    const popMap = elementsMap["PoP"] || {};

    const allStartTimes = Array.from(
      new Set([...Object.keys(minTMap), ...Object.keys(maxTMap)])
    ).sort();

    for (const rawStart of allStartTimes) {
      const minEntry = minTMap[rawStart];
      const maxEntry = maxTMap[rawStart];
      const wxEntry = wxMap[rawStart];
      const popEntry = popMap[rawStart];

      const rawEnd = minEntry?.endTime || maxEntry?.endTime || "";
      if (!rawEnd) continue;

      const forecastStart = normalizeTimeString(rawStart);
      const forecastEnd = normalizeTimeString(rawEnd);
      const forecastDate = forecastStart.slice(0, 10);

      const minVal = parseFloat(minEntry?.parameter?.parameterName || "0");
      const maxVal = parseFloat(maxEntry?.parameter?.parameterName || "0");
      if (isNaN(minVal) || isNaN(maxVal)) continue;

      const avgTemp = Math.round(((minVal + maxVal) / 2.0) * 10) / 10;
      const weatherDescription = wxEntry?.parameter?.parameterName || "";
      const rawPop = popEntry?.parameter?.parameterName;
      const rainProbability = rawPop && /^\d+$/.test(rawPop.trim()) ? parseInt(rawPop.trim(), 10) : null;

      recordsList.push({
        city,
        forecastStart,
        forecastEnd,
        forecastDate,
        minTemp: minVal,
        maxTemp: maxVal,
        avgTemp: avgTemp,
        weatherDescription,
        rainProbability,
        sourceUpdatedAt,
      });
    }
  }

  return recordsList;
}

/**
 * 伺服器端自中央氣象署 (CWA) 取得最新預報資料
 * 優先請求 F-D0047-091 (未來 1 週/7-8天預報)；若失敗則退回 F-C0032-001 (36小時預報)
 */
export async function fetchCwaForecasts(apiKey: string): Promise<ParsedCwaRecord[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("缺少 CWA_API_KEY");
  }

  const trimmedKey = apiKey.trim();

  // 1. 優先請求一週 (7天) 預報資料集 (F-D0047-091)
  try {
    const weeklyUrl = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${CWA_WEEKLY_DATASET_ID}?Authorization=${encodeURIComponent(trimmedKey)}`;
    const response = await fetch(weeklyUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const json: CwaWeeklyResponse = await response.json();
      if (json.success) {
        const weeklyRecords = parseWeeklyForecasts(json);
        if (weeklyRecords.length > 0) {
          return weeklyRecords;
        }
      }
    }
  } catch (err) {
    console.warn("CWA F-D0047-091 (一週預報) 請求失敗，嘗試備援資料集:", (err as Error).message);
  }

  // 2. 備援方案：請求 36 小時預報資料集 (F-C0032-001)
  const backupUrl = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${CWA_36H_DATASET_ID}?Authorization=${encodeURIComponent(trimmedKey)}`;
  const response = await fetch(backupUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`CWA API 回應錯誤，狀態碼: ${response.status}`);
  }

  const json: Cwa36hResponse = await response.json();
  if (!json.success || !json.records?.location) {
    throw new Error("CWA API 回傳結構異常，缺少 records.location");
  }

  return parse36hForecasts(json);
}
