import { getCareerSheet } from "@/lib/api/get-career-sheet"
import { CareerSheetForm } from "@/app/(app)/career/_components/career-sheet-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// 本人のキャリアシートをサーバ取得して編集フォームを描画する非同期 RSC。
// 未作成時 API は空シートを返すため、取得成功＝常にフォーム表示。
export async function CareerSheetSection() {
  const sheet = await getCareerSheet()

  if (sheet instanceof Error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>キャリアシート</CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-destructive">キャリアシートの取得に失敗しました</p>
        </CardContent>
      </Card>
    )
  }

  const updatedLabel = sheet.updated_at !== null ? `最終更新: ${sheet.updated_at}` : "未保存"

  return (
    <Card>
      <CardHeader>
        <CardTitle>キャリアシート</CardTitle>

        <CardDescription>{updatedLabel}</CardDescription>
      </CardHeader>

      <CardContent>
        <CareerSheetForm sheet={sheet} />
      </CardContent>
    </Card>
  )
}
