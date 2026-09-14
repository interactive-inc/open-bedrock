"use client"

import { LocaleField } from "@/app/(app)/settings/_components/locale-field"
import { ThemeModeField } from "@/app/(app)/settings/_components/theme-mode-field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Locale } from "@/lib/i18n/locale"

type Props = {
  locale: Locale
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 管理画面の表示テーマ・表示言語を変更する。
 * ヘッダーのユーザーメニュー「設定」から開く。
 */
export function SettingsDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>

          <DialogDescription>表示や操作に関する個人設定を変更できます。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-8">
          <ThemeModeField />

          <LocaleField locale={props.locale} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
