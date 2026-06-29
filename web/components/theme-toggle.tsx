import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toggleThemeAction } from "@/lib/theme/toggle-theme-action"
import type { Theme } from "@/lib/theme/get-theme"

type Props = {
  theme: Theme
}

/**
 * ライト / ダークを切り替えるアイコンボタン。Server Action で cookie を反転させて再描画する。
 */
export function ThemeToggle(props: Props) {
  const isDark = props.theme === "dark"

  return (
    <form action={toggleThemeAction}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={isDark ? "ライトモードに切替" : "ダークモードに切替"}
        title={isDark ? "ライトモードに切替" : "ダークモードに切替"}
      >
        {isDark ? <Sun /> : <Moon />}
      </Button>
    </form>
  )
}
