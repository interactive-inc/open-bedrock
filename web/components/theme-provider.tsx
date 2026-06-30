"use client"

import { useEffect } from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

type Props = {
  children: React.ReactNode
}

function ThemeMigration() {
  const { setTheme } = useTheme()

  useEffect(() => {
    // Skip if next-themes has already saved a preference
    if (localStorage.getItem("theme") !== null) return

    // Parse the legacy theme cookie
    const themeCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("theme="))
      ?.split("=")[1]

    if (themeCookie === "light" || themeCookie === "dark") {
      setTheme(themeCookie)
      // Remove the legacy cookie
      document.cookie = "theme=; max-age=0; path=/"
    }
  }, [setTheme])

  return null
}

export function ThemeProvider(props: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeMigration />
      {props.children}
    </NextThemesProvider>
  )
}
