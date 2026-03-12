import type { Metadata } from "next"
import { Noto_Sans_SC, Silkscreen } from "next/font/google"
import "./globals.css"

const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-sans-ui",
  weight: ["400", "500", "700", "900"],
})

const silkscreen = Silkscreen({
  subsets: ["latin"],
  variable: "--font-display-pixel",
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "Louis Room",
  description: "一个可点击、可漫游的像素 RPG 风格个人博客房间。",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSans.variable} ${silkscreen.variable} antialiased`}>{children}</body>
    </html>
  )
}
