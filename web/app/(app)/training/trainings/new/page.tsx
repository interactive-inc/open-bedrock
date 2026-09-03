import { notFound } from "next/navigation"
import { CreateCourseForm } from "@/app/(app)/training/trainings/_components/create-course-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageTraining } from "@/lib/training/can-manage-training"

export const metadata = { title: "研修コースの作成" }

export default async function NewTrainingCoursePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageTraining(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規コース"
        actions={<BackButton href="/training/trainings" label="研修に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <CreateCourseForm />
        </CardContent>
      </Card>
    </div>
  )
}
