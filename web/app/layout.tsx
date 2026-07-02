import type { Metadata } from "next"
import { Geist, Geist_Mono, Noto_Sans, Playfair_Display } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { getLocale } from "@/lib/i18n/get-locale"
import { TranslatorProvider } from "@/lib/i18n/translator-provider"
import { cn } from "@/lib/utils"

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
  const locale = await getLocale()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
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
        <ThemeProvider>
          <TranslatorProvider dictionary={getDictionary(locale)}>
            {props.children}

            <Toaster />
          </TranslatorProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
