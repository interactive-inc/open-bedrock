import { ThemeModeField } from "@/app/(app)/settings/_components/theme-mode-field"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "設定" }

// 個人設定画面。表示テーマなど、端末やユーザーごとの表示設定を扱う。
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="設定" description="表示や操作に関する個人設定を変更できます。" />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>表示</CardTitle>
          <CardDescription>画面の見え方を調整します。</CardDescription>
        </CardHeader>

        <CardContent>
          <ThemeModeField />
        </CardContent>
      </Card>
    </div>
  )
}
