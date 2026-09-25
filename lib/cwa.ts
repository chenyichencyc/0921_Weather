const CWA_DATASET_ID = "F-C0032-001";
const CWA_BASE_URL = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${CWA_DATASET_ID}`;

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

interface CwaTimeEntry {
  startTime: string;
  endTime: string;
  parameter: {
    parameterName: string;
    parameterValue?: string;
    parameterUnit?: string;
  };
}

interface CwaElement {
  elementName: string;
  time: CwaTimeEntry[];
}

interface CwaLocation {
  locationName: string;
  weatherElement: CwaElement[];
}

interface CwaApiResponse {
  success: string | boolean;
  records?: {
    location?: CwaLocation[];
  };
}

/**
 * 伺服器端自中央氣象署 (CWA) 取得最新預報資料並解析
 */
export async function fetchCwaForecasts(apiKey: string): Promise<ParsedCwaRecord[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("缺少 CWA_API_KEY");
  }

  const url = `${CWA_BASE_URL}?Authorization=${encodeURIComponent(apiKey.trim())}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    // 快取策略：由伺服器端控制或每隔 10 分鐘重新驗證
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`CWA API 回應錯誤，狀態碼: ${response.status}`);
  }

  const json: CwaApiResponse = await response.json();
  if (!json.success || !json.records?.location) {
    throw new Error("CWA API 回傳結構異常，缺少 records.location");
  }

  const recordsList: ParsedCwaRecord[] = [];
  const sourceUpdatedAt = new Date().toISOString();

  for (const loc of json.records.location) {
    const city = loc.locationName?.trim();
    if (!city) continue;

    const elementsMap: Record<string, Record<string, CwaTimeEntry>> = {};
    for (const el of loc.weatherElement || []) {
      const timeMap: Record<string, CwaTimeEntry> = {};
      for (const t of el.time || []) {
        if (t.startTime) {
          timeMap[t.startTime] = t;
        }
      }
      elementsMap[el.elementName] = timeMap;
    }

    const minTMap = elementsMap["MinT"] || {};
    const maxTMap = elementsMap["MaxT"] || {};
    const wxMap = elementsMap["Wx"] || {};
    const popMap = elementsMap["PoP"] || {};

    const allStartTimes = Array.from(
      new Set([...Object.keys(minTMap), ...Object.keys(maxTMap)])
    ).sort();

    for (const startTime of allStartTimes) {
      const minEntry = minTMap[startTime];
      const maxEntry = maxTMap[startTime];
      const wxEntry = wxMap[startTime];
      const popEntry = popMap[startTime];

      const endTime = minEntry?.endTime || maxEntry?.endTime || "";
      if (!endTime) continue;

      const forecastDate = startTime.includes(" ")
        ? startTime.split(" ")[0]
        : startTime.slice(0, 10);

      const minVal = parseFloat(minEntry?.parameter?.parameterName || "0");
      const maxVal = parseFloat(maxEntry?.parameter?.parameterName || "0");

      if (isNaN(minVal) || isNaN(maxVal)) continue;

      const avgTemp = Math.round(((minVal + maxVal) / 2.0) * 10) / 10;
      const weatherDescription = wxEntry?.parameter?.parameterName || "";

      const rawPop = popEntry?.parameter?.parameterName;
      const rainProbability = rawPop && /^\d+$/.test(rawPop) ? parseInt(rawPop, 10) : null;

      recordsList.push({
        city,
        forecastStart: startTime,
        forecastEnd: endTime,
        forecastDate,
        minTemp: minVal,
        maxTemp: maxVal,
        avgTemp,
        weatherDescription,
        rainProbability,
        sourceUpdatedAt,
      });
    }
  }

  return recordsList;
}
