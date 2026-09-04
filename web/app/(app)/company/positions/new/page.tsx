import { notFound } from "next/navigation"
import { PositionCreateForm } from "@/app/(app)/company/positions/_components/position-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManagePositions } from "@/lib/position/can-manage-positions"

export const metadata = { title: "役職の作成" }

export default async function NewPositionPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePositions(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="新規役職">
        <BackButton href="/company/positions" label="役職に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <PositionCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
