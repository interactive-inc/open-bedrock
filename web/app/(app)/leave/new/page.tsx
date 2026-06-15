import { LeaveRequestCreateForm } from "@/app/(app)/leave/_components/leave-request-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "休暇の申請" }

/**
 * 休暇の新規申請。フォーム単機能のページとして、一覧から独立させる。
 */
export default function NewLeaveRequestPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="休暇を申請"
        description="休暇種別・期間・理由を入力して申請します。"
        actions={<BackButton href="/leave" label="休暇に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <LeaveRequestCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
