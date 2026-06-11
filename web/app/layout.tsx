import type { Metadata } from "next"
import { Geist, Geist_Mono, Noto_Sans, Playfair_Display } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"

const playfairDisplayHeading = Playfair_Display({ subsets: ["latin"], variable: "--font-heading" })

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "open-karte",
    template: "%s | open-karte",
  },
  description: "社内事務手続きのためのセルフホスト基盤",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        geistSans.variable,
        geistMono.variable,
        notoSans.variable,
        playfairDisplayHeading.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        {children}

        <Toaster />
      </body>
    </html>
  )
}
