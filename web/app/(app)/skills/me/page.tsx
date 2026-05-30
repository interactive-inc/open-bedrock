import { Suspense } from "react"
import Link from "next/link"
import { MySkillList } from "@/app/(app)/skills/me/my-skill-list"
import { SkillUpdateForm } from "@/app/(app)/skills/me/skill-update-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// /skills/me 自分のスキル画面。本人の登録済みスキル一覧と、登録/更新フォームを並べる。
export default function MySkillsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">自分のスキル</h1>

        <Button variant="outline" render={<Link href="/skills" />}>
          スキル一覧
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>登録済みスキル</CardTitle>

          <CardDescription>自分が登録しているスキルとレベルの一覧です</CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense fallback={<MySkillListSkeleton />}>
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

function MySkillListSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
