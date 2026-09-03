import { Suspense } from "react"
import Link from "next/link"
import { MySkillList } from "@/app/(app)/my/skills/_components/my-skill-list"
import { SkillUpdateForm } from "@/app/(app)/my/skills/_components/skill-update-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "自分のスキル" }

/** /skills/me 自分のスキル画面。本人の登録済みスキル一覧と、登録/更新フォームを並べる。 */
export default function MySkillsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="自分のスキル"
        description="登録済みスキルを確認し、新しいスキルを登録します。"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/skill/skills" />}>
            スキル一覧
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>登録済みスキル</CardTitle>

          <CardDescription>自分が登録しているスキルとレベルの一覧です</CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-10 w-full" />}>
            <MySkillList />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スキルを登録 / 更新</CardTitle>

          <CardDescription>
            スキルコードを指定して保存すると、同じコードは上書きされます
          </CardDescription>
        </CardHeader>

        <CardContent>
          <SkillUpdateForm />
        </CardContent>
      </Card>
    </div>
  )
}
