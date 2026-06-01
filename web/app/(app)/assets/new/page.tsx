import Link from "next/link"
import { AssetCreateForm } from "@/app/(app)/assets/asset-create-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export const metadata = { title: "備品登録" }

// 物品登録画面。フォームは Client Component に切り出し、Server Action で POST /assets する。
export default function AssetNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">物品を登録</h1>

        <Button variant="outline" render={<Link href="/assets" />}>
          一覧へ戻る
        </Button>
      </div>

      <Card className="max-w-xl p-0 gap-0">
        <div className="p-6">
          <AssetCreateForm />
        </div>
      </Card>
    </div>
  )
}
