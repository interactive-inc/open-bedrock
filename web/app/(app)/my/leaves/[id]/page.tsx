import { LeaveDraftDiscardForm } from "@/app/(app)/my/leaves/[id]/_components/leave-draft-discard-form"
import { LeaveDecisionHistory } from "@/app/(app)/my/leaves/[id]/_components/leave-decision-history"
import { leaveProcedureStatusLabel } from "@/lib/leave/leave-procedure-status-label"
import Link from "next/link"
import { getLeaveProcedureRequest } from "@/lib/api/get-leave-procedure-request"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { LeaveProcedureForm } from "@/app/(app)/my/leaves/[id]/_components/leave-procedure-form"

type Props = { params: Promise<{ id: string }> }
export const metadata = { title: "休暇の内容と判断" }

/** 休暇内容と判断の履歴を確認し、提出・判断・確定を行う。 */
export default async function LeaveProcedurePage(props: Props) {
  const params = await props.params
  const leave = await getLeaveProcedureRequest(Number(params.id))
  if (leave instanceof Error) return <FetchError message={leave.message} />
  const previousId = leave.previous_leave_request_id
  const form = {
    id: leave.id,
    previousId:
      previousId !== null && Number.isSafeInteger(previousId) && previousId > 0 ? previousId : null,
    requestKey: crypto.randomUUID(),
    contentDigest: leave.confirmed_content_digest,
    target: leave.decision_target,
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="休暇の内容と判断">
        <Link href="/my/leaves">休暇一覧へ</Link>
      </PageHeader>
      <dl className="grid gap-2">
        <dt>申請者</dt>
        <dd>{leave.applicant_name}</dd>
        <dt>種別</dt>
        <dd>
          <LeaveTypeLabel leaveType={leave.leave_type} />
        </dd>
        <dt>期間</dt>
        <dd>
          {leave.start_date} 〜 {leave.end_date}
        </dd>
        <dt>消費日数</dt>
        <dd>{leave.consumed_days} 日</dd>
        <dt>理由</dt>
        <dd className="whitespace-pre-wrap">{leave.reason ?? "記載なし"}</dd>
        <dt>状態</dt>
        <dd>{leaveProcedureStatusLabel(leave.status, leave.procedure_required)}</dd>
      </dl>
      <LeaveDecisionHistory
        decisions={leave.decisions}
        approvals={leave.approvals}
        required_approvals={leave.required_approvals}
      />
      {leave.previous_leave_request_id !== null ? (
        <Link href={`/my/leaves/${leave.previous_leave_request_id}`}>
          差戻し元の内容と判断を見る
        </Link>
      ) : null}
      {leave.next_leave_request_id !== null ? (
        <Link href={`/my/leaves/${leave.next_leave_request_id}`}>修正して再提出した内容を見る</Link>
      ) : null}
      {leave.can_resubmit ? (
        <Link href={`/my/leaves/new?previous=${leave.id}`}>内容を修正して再提出</Link>
      ) : null}
      {leave.can_submit ? (
        <div className="flex flex-col gap-3">
          <Link href={`/my/leaves/${leave.id}/edit`}>未提出の内容を編集</Link>
          <LeaveProcedureForm key={`submit:${form.contentDigest}`} {...form} operation="submit" />
          <LeaveDraftDiscardForm id={leave.id} />
        </div>
      ) : null}
      {leave.can_decide ? (
        <LeaveProcedureForm key={JSON.stringify(form.target)} {...form} operation="decision" />
      ) : null}
      {leave.can_cancel ? (
        <LeaveProcedureForm
          key={`cancel:${JSON.stringify(form.target)}`}
          {...form}
          operation="cancel"
        />
      ) : null}
      {leave.can_execute ? (
        <LeaveProcedureForm
          key={`complete:${JSON.stringify(form.target)}`}
          {...form}
          operation="complete"
        />
      ) : null}
    </div>
  )
}
