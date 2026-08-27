"use client"

import { LocaleField } from "@/app/(app)/my/settings/_components/locale-field"
import { PhoneField } from "@/app/(app)/my/settings/_components/phone-field"
import { ThemeModeField } from "@/app/(app)/my/settings/_components/theme-mode-field"
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
  phone: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 個人設定モーダル。表示テーマ・表示言語・電話番号を変更する。
 * ヘッダーのユーザーメニュー「設定」から開く。
 *
 * 以前はサイドメニューの「個人設定」ページ（/my/settings）に同じ項目が並んでいたが、
 * 同じ設定が 2 か所にあると、どちらで変えたものが反映されるのか利用者が判断できないため、
 * 入口をこのモーダルへ寄せた。
 */
export function SettingsDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>

          <DialogDescription>表示や操作に関する個人設定を変更できます。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <ThemeModeField />

          <LocaleField locale={props.locale} />

          <PhoneField phone={props.phone} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
