import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VerticalTec | แบบฟอร์ม Check List งานเปลี่ยนระบบ POS สาขา (Replace POS – ThaiBev)",
  description:
    "แบบฟอร์ม Check List งานเปลี่ยนระบบ POS สาขา (Replace POS – ThaiBev) บริษัท เวอร์ติคัลเทค จำกัด พร้อมพิมพ์ A4 และ Export Excel / Word",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.className} bg-slate-100 text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
