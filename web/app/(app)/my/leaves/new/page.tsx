import { LeaveRequestCreateForm } from "@/app/(app)/my/leaves/_components/leave-request-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "休暇の申請" }

/**
 * 休暇の新規申請。フォーム単機能のページとして、一覧から独立させる。
 */
export default function NewLeaveRequestPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="休暇を申請">
        <BackButton href="/my/leaves" label="休暇に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <LeaveRequestCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
