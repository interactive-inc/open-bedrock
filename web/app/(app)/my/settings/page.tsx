import { LocaleField } from "@/app/(app)/my/settings/_components/locale-field"
import { PhoneField } from "@/app/(app)/my/settings/_components/phone-field"
import { ThemeModeField } from "@/app/(app)/my/settings/_components/theme-mode-field"
import { PageHeader } from "@/components/page-header"
import { getLocale } from "@/lib/i18n/get-locale"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "設定" }

/** 個人設定画面。表示テーマ・表示言語・電話番号など、端末やユーザーごとの設定を扱う。 */
export default async function SettingsPage() {
  const locale = await getLocale()

  const me = await getMe()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="設定" description="表示や操作に関する個人設定を変更できます。" />

      <div className="flex flex-col">
        <div className="border-b border-border pb-6">
          <ThemeModeField />
        </div>

        <div className="border-b border-border py-6">
          <LocaleField locale={locale} />
        </div>

        <div className="py-6">
          <PhoneField phone={me.phone} />
        </div>
      </div>
    </div>
  )
}
