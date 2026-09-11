import { notFound } from "next/navigation"
import { getLeaveProcedureRequest } from "@/lib/api/get-leave-procedure-request"
import { LeaveRequestCreateForm } from "@/app/(app)/my/leaves/_components/leave-request-create-form"
import { PageHeader } from "@/components/page-header"
import Link from "next/link"

export const metadata = { title: "未提出の休暇を編集" }

export default async function EditLeavePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const leave = await getLeaveProcedureRequest(Number(id))
  if (leave instanceof Error || !leave.can_submit) notFound()
  const previousId = leave.previous_leave_request_id ?? undefined
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="未提出の休暇を編集">
        <Link href={`/my/leaves/${leave.id}`}>内容の確認へ戻る</Link>
      </PageHeader>
      <LeaveRequestCreateForm requestId={leave.id} previousId={previousId} initial={leave} />
    </div>
  )
}
