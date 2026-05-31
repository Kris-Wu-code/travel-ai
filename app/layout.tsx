import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "./components/app-providers";

export const metadata: Metadata = {
  title: "Travel AI · 智能旅行规划",
  description: "个性化景区探索、路线规划与旅行内容发现平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
