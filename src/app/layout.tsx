import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 选股器 | 智能选股 - stock.lancy.site",
  description: "AI 驱动的智能选股平台，基于技术指标和人工智能分析，每日生成精准选股信号。支持自选股管理、价格提醒、深度分析报告。",
  keywords: "AI选股, 智能选股, 股票分析, 量化交易, 选股信号, 技术分析, 美股选股",
  authors: [{ name: "Lancy" }],
  openGraph: {
    title: "AI 选股器 | 智能选股",
    description: "AI 驱动的智能选股平台，每日生成精准选股信号",
    url: "https://stock.lancy.site",
    siteName: "AI 选股器",
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
