import { notFound } from "next/navigation"
import { GradeCreateForm } from "@/app/(app)/company/grades/_components/grade-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageGrades } from "@/lib/grade/can-manage-grades"

export const metadata = { title: "等級の作成" }

export default async function NewGradePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageGrades(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規等級"
        actions={<BackButton href="/company/grades" label="等級に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <GradeCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
