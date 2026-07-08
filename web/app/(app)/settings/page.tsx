import { LocaleField } from "@/app/(app)/settings/_components/locale-field"
import { ThemeModeField } from "@/app/(app)/settings/_components/theme-mode-field"
import { PageHeader } from "@/components/page-header"
import { getLocale } from "@/lib/i18n/get-locale"

export const metadata = { title: "設定" }

// 個人設定画面。表示テーマ・表示言語など、端末やユーザーごとの表示設定を扱う。
export default async function SettingsPage() {
  const locale = await getLocale()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="設定" description="表示や操作に関する個人設定を変更できます。" />

      <div className="flex flex-col divide-y">
        <div className="pb-6">
          <ThemeModeField />
        </div>

        <div className="pt-6">
          <LocaleField locale={locale} />
        </div>
      </div>
    </div>
  )
}
