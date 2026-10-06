"""
台灣天氣預報儀表板 Streamlit 版
課程技術相容版 (Python + Pandas + SQLite + Streamlit + Folium)
"""

import json
import sqlite3
from pathlib import Path
import folium
import pandas as pd
import streamlit as st
from streamlit_folium import st_folium

# 路徑設定
ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "weather.db"
GEOJSON_PATH = DATA_DIR / "taiwan-cities.geojson"

# 22 縣市標準清單
TAIWAN_CITIES = [
    "基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣",
    "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市",
    "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣",
    "臺東縣", "澎湖縣", "金門縣", "連江縣"
]

# 頁面基本配置
st.set_page_config(
    page_title="台灣天氣預報儀表板 Streamlit 版",
    page_icon="🌤️",
    layout="wide",
    initial_sidebar_state="expanded",
)


def normalize_city_name(name: str) -> str:
    """將縣市名稱統一為 CWA 標準名稱 (例如: 台東縣 -> 臺東縣, 桃園縣 -> 桃園市)"""
    if not name:
        return ""
    n = str(name).strip()
    if n == "桃園縣":
        return "桃園市"
    if n.startswith("台"):
        n = "臺" + n[1:]
    return n


def get_temperature_color(avg_temp: float | None) -> str:
    """依據平均氣溫對應顏色"""
    if avg_temp is None or pd.isna(avg_temp):
        return "#94a3b8"  # 灰色 (無資料)
    if avg_temp < 20:
        return "#3b82f6"  # 藍色 (偏涼)
    if avg_temp < 25:
        return "#10b981"  # 綠色 (舒適)
    if avg_temp < 30:
        return "#f59e0b"  # 黃色/橘色 (溫暖)
    return "#ef4444"      # 紅色 (炎熱)


def get_temperature_status(avg_temp: float | None) -> str:
    """取得氣溫感受級別"""
    if avg_temp is None or pd.isna(avg_temp):
        return "無資料"
    if avg_temp < 20:
        return "偏涼 (<20°C)"
    if avg_temp < 25:
        return "舒適 (20-24.9°C)"
    if avg_temp < 30:
        return "溫暖 (25-29.9°C)"
    return "炎熱 (≥30°C)"


def format_short_time(time_str: str) -> str:
    """將 YYYY-MM-DD HH:mm:ss 轉換為 MM/DD HH:mm"""
    if not time_str:
        return ""
    parts = time_str.split(" ")
    if len(parts) == 2:
        d_parts = parts[0].split("-")
        t_parts = parts[1].split(":")
        if len(d_parts) == 3 and len(t_parts) >= 2:
            return f"{d_parts[1]}/{d_parts[2]} {t_parts[0]}:{t_parts[1]}"
    return time_str


def load_data_from_sqlite() -> pd.DataFrame:
    """自本機 SQLite 讀取 forecasts 表並轉為 Pandas DataFrame"""
    if not DB_PATH.exists():
        return pd.DataFrame()

    conn = sqlite3.connect(DB_PATH)
    try:
        query = """
        SELECT
            id,
            city,
            forecast_start,
            forecast_end,
            forecast_date,
            min_temp,
            max_temp,
            avg_temp,
            weather_description,
            rain_probability,
            source_updated_at,
            created_at
        FROM forecasts
        ORDER BY city ASC, forecast_start ASC
        """
        df = pd.read_sql_query(query, conn)
        return df
    except Exception:
        return pd.DataFrame()
    finally:
        conn.close()


def load_geojson() -> dict | None:
    """讀取本地台灣縣市 GeoJSON 檔案"""
    if not GEOJSON_PATH.exists():
        return None
    try:
        with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def main():
    # 標題與簡介
    st.title("🌤️ 台灣天氣預報儀表板 Streamlit 版")
    st.markdown(
        "**課程技術相容版**：使用 `Python` + `Pandas` + `SQLite` + `Streamlit` + `Folium` 實作之本地天氣 GIS 儀表板，"
        "與 Next.js 正式網站共用 CWA 官方預報資料模型。"
    )

    # 1. 讀取 SQLite 資料
    df = load_data_from_sqlite()

    # 資料庫不存在或無資料時的友善引導
    if df.empty:
        st.warning("⚠️ 本機資料庫尚未初始化或目前無預報資料！")
        st.info(
            "請先在終端機中執行下列指令以初始化資料庫並自中央氣象署 (CWA) 抓取最新資料：\n\n"
            "```bash\n"
            "python scripts/init_sqlite.py\n"
            "python scripts/refresh_sqlite.py\n"
            "```"
        )
        return

    # 2. 側邊欄控制項 (Sidebar)
    st.sidebar.header("⚙️ 篩選控制項")

    # 縣市選擇器
    db_cities = sorted(df["city"].unique())
    city_options = [c for c in TAIWAN_CITIES if c in db_cities] or db_cities
    default_city_idx = city_options.index("臺北市") if "臺北市" in city_options else 0
    selected_city = st.sidebar.selectbox("📍 選擇縣市", city_options, index=default_city_idx)

    # 日期選擇器
    available_dates = sorted(df["forecast_date"].unique())
    selected_date = st.sidebar.selectbox("📅 選擇預報日期", available_dates, index=0)

    # 依日期過濾時段
    date_df = df[df["forecast_date"] == selected_date].copy()
    raw_intervals = (
        date_df[["forecast_start", "forecast_end"]]
        .drop_duplicates()
        .sort_values("forecast_start")
        .to_dict(orient="records")
    )

    interval_labels = [
        f"{format_short_time(i['forecast_start'])} ~ {format_short_time(i['forecast_end'])}"
        for i in raw_intervals
    ]
    selected_interval_idx = st.sidebar.selectbox(
        "⏰ 選擇預報時段",
        range(len(interval_labels)),
        format_func=lambda idx: interval_labels[idx] if idx < len(interval_labels) else "",
        index=0,
    )

    current_start = raw_intervals[selected_interval_idx]["forecast_start"]
    current_end = raw_intervals[selected_interval_idx]["forecast_end"]
    current_interval_label = interval_labels[selected_interval_idx]

    # 3. 取得當前選定縣市與時段紀錄
    city_interval_df = df[
        (df["city"] == selected_city)
        & (df["forecast_start"] == current_start)
        & (df["forecast_end"] == current_end)
    ]
    
    # 若在當前時段無此縣市資料，退回此縣市第一筆
    current_city_record = (
        city_interval_df.iloc[0]
        if not city_interval_df.empty
        else df[df["city"] == selected_city].iloc[0]
    )

    # 4. 頂部溫度指標卡片 (Metrics)
    st.subheader(f"📊 【{selected_city}】預報摘要 ({current_interval_label})")
    m_col1, m_col2, m_col3, m_col4, m_col5 = st.columns(5)

    with m_col1:
        st.metric(
            label="❄️ 最低溫",
            value=f"{current_city_record['min_temp']} °C",
        )
    with m_col2:
        st.metric(
            label="🔥 最高溫",
            value=f"{current_city_record['max_temp']} °C",
        )
    with m_col3:
        avg_t = current_city_record["avg_temp"]
        st.metric(
            label="🌡️ 平均溫",
            value=f"{avg_t} °C",
            delta=get_temperature_status(avg_t),
            delta_color="off",
        )
    with m_col4:
        st.metric(
            label="🌤️ 天氣現象",
            value=current_city_record["weather_description"] or "正常",
        )
    with m_col5:
        pop = current_city_record["rain_probability"]
        pop_str = f"{pop}%" if pd.notna(pop) else "--"
        st.metric(
            label="💧 降雨機率",
            value=pop_str,
        )

    st.write("")

    # 5. 主區域：GIS 互動地圖與氣溫趨勢折線圖
    col_map, col_chart = st.columns([1.1, 0.9])

    # 取得當前時段全台所有縣市的預報資料
    table_df = df[
        (df["forecast_start"] == current_start) & (df["forecast_end"] == current_end)
    ].copy()

    with col_map:
        st.subheader("🗺️ 台灣氣溫 GIS 互動地圖 (Folium)")
        geojson_data = load_geojson()

        if geojson_data:
            # 建立城市名稱對應之資料映射字典
            weather_map = {}
            for _, row in table_df.iterrows():
                n_city = normalize_city_name(row["city"])
                weather_map[n_city] = row.to_dict()

            # 初始化 Folium 地圖 (中心點設在台灣)
            m = folium.Map(
                location=[23.7, 120.95],
                zoom_start=7,
                tiles="CartoDB positron",
                scrollWheelZoom=False,
            )

            # 多邊形樣式設定函數
            def style_fn(feature):
                raw_name = (
                    feature.get("properties", {}).get("COUNTYNAME")
                    or feature.get("properties", {}).get("name")
                    or ""
                )
                city_name = normalize_city_name(raw_name)
                weather = weather_map.get(city_name)
                avg_temp = weather.get("avg_temp") if weather else None
                fill_color = get_temperature_color(avg_temp)
                is_selected = city_name == selected_city

                return {
                    "fillColor": fill_color,
                    "color": "#0f172a" if is_selected else "#ffffff",
                    "weight": 3 if is_selected else 1.2,
                    "fillOpacity": 0.88 if is_selected else 0.72,
                }

            # 建立 Tooltip 與 Popup 綁定
            for feature in geojson_data.get("features", []):
                raw_name = (
                    feature.get("properties", {}).get("COUNTYNAME")
                    or feature.get("properties", {}).get("name")
                    or ""
                )
                city_name = normalize_city_name(raw_name)
                weather = weather_map.get(city_name)

                if weather:
                    avg_val = f"{weather['avg_temp']}°C"
                    min_val = f"{weather['min_temp']}°C"
                    max_val = f"{weather['max_temp']}°C"
                    wx_val = weather.get("weather_description") or "無"
                    pop_val = (
                        f"{weather['rain_probability']}%"
                        if pd.notna(weather.get("rain_probability"))
                        else "--"
                    )
                else:
                    avg_val = min_val = max_val = wx_val = pop_val = "無資料"

                # 懸浮 Tooltip
                feature["properties"]["tooltip_content"] = (
                    f"<strong>{city_name}</strong>: {avg_val} · {wx_val}"
                )

                # 點擊 Popup HTML
                feature["properties"]["popup_html"] = f"""
                <div style="font-family: system-ui, sans-serif; font-size: 13px; min-width: 170px;">
                    <h4 style="margin: 0 0 6px 0; font-size: 15px; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
                        📍 {city_name}
                    </h4>
                    <p style="margin: 2px 0;"><b>平均氣溫：</b> {avg_val}</p>
                    <p style="margin: 2px 0; color: #ef4444;"><b>最高氣溫：</b> {max_val}</p>
                    <p style="margin: 2px 0; color: #3b82f6;"><b>最低氣溫：</b> {min_val}</p>
                    <p style="margin: 2px 0; color: #6366f1;"><b>降雨機率：</b> {pop_val}</p>
                    <p style="margin: 2px 0; color: #475569;"><b>天氣狀況：</b> {wx_val}</p>
                </div>
                """

            folium.GeoJson(
                geojson_data,
                style_function=style_fn,
                tooltip=folium.GeoJsonTooltip(
                    fields=["tooltip_content"],
                    aliases=[""],
                    labels=False,
                    sticky=True,
                ),
                popup=folium.GeoJsonPopup(
                    fields=["popup_html"],
                    aliases=[""],
                    labels=False,
                ),
            ).add_to(m)

            # 加入 HTML 浮動圖例
            legend_html = """
            <div style="
                position: fixed;
                bottom: 25px;
                right: 25px;
                z-index: 1000;
                background-color: rgba(255, 255, 255, 0.92);
                padding: 10px 14px;
                border: 1px solid #cbd5e1;
                border-radius: 10px;
                font-size: 12px;
                line-height: 1.5;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            ">
                <b>🌡️ 氣溫圖例</b><br>
                <span style="color:#ef4444;">■</span> ≥ 30°C (炎熱)<br>
                <span style="color:#f59e0b;">■</span> 25–29.9°C (溫暖)<br>
                <span style="color:#10b981;">■</span> 20–24.9°C (舒適)<br>
                <span style="color:#3b82f6;">■</span> &lt; 20°C (偏涼)<br>
                <span style="color:#94a3b8;">■</span> 無資料
            </div>
            """
            m.get_root().html.add_child(folium.Element(legend_html))

            st_folium(m, width=650, height=450, returned_objects=[])
        else:
            st.error("⚠️ 未能載入本地 GeoJSON 檔案 (data/taiwan-cities.geojson)")

    with col_chart:
        st.subheader(f"📈 【{selected_city}】氣溫趨勢走勢")
        # 繪製選定縣市的氣溫折線圖
        city_full_df = df[df["city"] == selected_city].copy()
        if not city_full_df.empty:
            city_full_df["時段"] = city_full_df["forecast_start"].apply(format_short_time)
            chart_df = city_full_df.set_index("時段")[["max_temp", "min_temp", "avg_temp"]]
            chart_df.columns = ["最高溫 (°C)", "最低溫 (°C)", "平均溫 (°C)"]

            st.line_chart(
                chart_df,
                color=["#f97316", "#3b82f6", "#10b981"],
                height=380,
            )
            st.caption(f"呈現 {selected_city} 未來 36 小時各預報時段氣溫預測變化")
        else:
            st.info(f"目前無「{selected_city}」的趨勢資料")

    st.write("")

    # 6. 全台預報總表 (Pandas DataFrame)
    st.subheader(f"📋 全台各縣市天氣預報總表 ({current_interval_label})")
    if not table_df.empty:
        display_df = table_df.copy()
        display_df = display_df.sort_values("city")
        display_df = display_df[
            [
                "city",
                "min_temp",
                "max_temp",
                "avg_temp",
                "weather_description",
                "rain_probability",
                "source_updated_at",
            ]
        ]
        display_df.columns = [
            "縣市",
            "最低溫 (°C)",
            "最高溫 (°C)",
            "平均溫 (°C)",
            "天氣現象",
            "降雨機率 (%)",
            "資料更新時間",
        ]

        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("選定時段暫無全台縣市資料")

    # 頁尾說明
    st.divider()
    st.caption(
        "💡 **技術架構備註**：\n"
        "- 本 Streamlit 應用程式專為課程技術需求（Python / Pandas / SQLite / Streamlit / Folium）所設計之本地展示版。\n"
        "- 正式公開網站架構為 Next.js + Leaflet + Vercel + Supabase (Dual-Source CWA-first)，請造訪專案公開部署網址。"
    )


if __name__ == "__main__":
    main()
