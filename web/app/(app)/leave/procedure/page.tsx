import Link from "next/link"
import { notFound } from "next/navigation"
import { getMe } from "@/lib/api/get-me"
import { getLeaveProcedure } from "@/lib/api/get-leave-procedure"
import { WorkflowEditor } from "@/app/(app)/system/application-templates/[template]/workflow/_components/workflow-editor"
import { saveLeaveProcedureAction } from "@/app/(app)/leave/procedure/actions"
import { PageHeader } from "@/components/page-header"
import { FetchError } from "@/components/fetch-error"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

export const metadata = { title: "休暇の承認規程" }

/** 休暇を受け付ける会社上の資格と必要人数を明示的に設定する。 */
export default async function LeaveProcedurePage() {
  const results = await Promise.all([getMe(), getLeaveProcedure()])
  const user = results[0]
  const procedure = results[1]
  if (
    user instanceof Error ||
    (!user.permissions.includes("leave:procedure:manage") &&
      !user.permissions.includes("system:admin"))
  )
    notFound()
  if (procedure instanceof Error) return <FetchError message={procedure.message} />
  const initial: ApplicationWorkflow = procedure.workflow ?? {
    version: 1,
    steps: [
      {
        key: "manager_review",
        name: "上長承認",
        approvers: [{ type: "direct_manager" }],
        approval_mode: "any",
        condition_mode: "all",
        conditions: [],
        due_days: null,
        escalation_approvers: [],
        rejection_behavior: "return",
        allow_delegation: true,
      },
    ],
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="休暇の承認規程">
        <Link href="/my/leaves">休暇一覧へ</Link>
      </PageHeader>
      <p>新しく提出する休暇に適用します。提出済みの休暇には、提出時の規程が残ります。</p>
      <WorkflowEditor
        code="leave_request"
        initial={initial}
        revision={procedure.revision}
        saveAction={saveLeaveProcedureAction}
      />
    </div>
  )
}
