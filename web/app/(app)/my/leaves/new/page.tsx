import { getLeaveProcedureRequest } from "@/lib/api/get-leave-procedure-request"
import { notFound } from "next/navigation"
import { LeaveRequestCreateForm } from "@/app/(app)/my/leaves/_components/leave-request-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "休暇の申請" }

/**
 * 休暇の新規申請。フォーム単機能のページとして、一覧から独立させる。
 */
export default async function NewLeaveRequestPage(props: {
  searchParams: Promise<{ previous?: string }>
}) {
  const params = await props.searchParams
  const previousId = params.previous === undefined ? null : Number(params.previous)
  if (previousId !== null && (!Number.isSafeInteger(previousId) || previousId <= 0)) notFound()
  const previous = previousId === null ? null : await getLeaveProcedureRequest(previousId)
  if (previous instanceof Error || (previous !== null && !previous.can_resubmit)) notFound()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="休暇を申請">
        <BackButton href="/my/leaves" label="休暇に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <LeaveRequestCreateForm
            key={previousId ?? "new"}
            previousId={previousId ?? undefined}
            initial={previous ?? undefined}
          />
        </CardContent>
      </Card>
    </div>
  )
}
