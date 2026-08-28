"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/** ブラウザ標準のピッカーを持つ type。枠のどこを押してもピッカーを開く対象。 */
const PICKER_TYPES = new Set(["date", "datetime-local", "month", "time", "week"])

function Input({ className, type, onClick, ...props }: React.ComponentProps<"input">) {
  /**
   * 日付・時刻はほとんど手入力されないため、枠のどこを押してもピッカーを開く。
   * ブラウザ既定では端のカレンダーアイコンを正確に押さないと開かず、当たり判定が狭い。
   */
  function handleClick(event: React.MouseEvent<HTMLInputElement>) {
    onClick?.(event)

    if (event.defaultPrevented) return

    if (type === undefined) return

    if (!PICKER_TYPES.has(type)) return

    const input = event.currentTarget

    if (input.disabled) return

    if (input.readOnly) return

    try {
      input.showPicker()
    } catch {
      // showPicker 非対応のブラウザや、ユーザー操作と見なされなかった場合に投げる。
      // 手入力は従来どおりできるので、開けないときは黙って諦める。
    }
  }

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      onClick={handleClick}
      className={cn(
        "h-9 w-full min-w-0 rounded-4xl border border-input bg-card px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
