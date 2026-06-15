import type { Metadata } from "next"
import { Geist, Geist_Mono, Noto_Sans, Playfair_Display } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { getTheme } from "@/lib/theme/get-theme"

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
    default: "KARTE",
    template: "%s | KARTE",
  },
  description: "社内事務手続きのためのセルフホスト基盤",
}

type Props = {
  children: React.ReactNode
}

export default async function RootLayout(props: Props) {
  const theme = await getTheme()

  return (
    <html
      lang="ja"
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        theme === "dark" ? "dark" : "",
        geistSans.variable,
        geistMono.variable,
        notoSans.variable,
        playfairDisplayHeading.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        {props.children}

        <Toaster />
      </body>
    </html>
  )
}
