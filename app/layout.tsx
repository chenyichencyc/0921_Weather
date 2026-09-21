import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台灣天氣 GIS 儀表板",
  description: "全台各縣市氣溫預報與 GIS 地圖儀表板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
