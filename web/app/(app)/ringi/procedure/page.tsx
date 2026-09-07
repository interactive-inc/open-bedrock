import Link from "next/link"
import { notFound } from "next/navigation"
import { getMe } from "@/lib/api/get-me"
import { getRingiProcedure } from "@/lib/api/get-ringi-procedure"
import { WorkflowEditor } from "@/app/(app)/system/application-templates/[template]/workflow/_components/workflow-editor"
import { saveRingiProcedureAction } from "@/app/(app)/ringi/procedure/actions"
import { PageHeader } from "@/components/page-header"
import { FetchError } from "@/components/fetch-error"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

export const metadata = { title: "稟議の承認規程" }

/** 稟議を受け付ける会社上の資格と必要人数を明示的に設定する。 */
export default async function RingiProcedurePage() {
  const results = await Promise.all([getMe(), getRingiProcedure()])
  const user = results[0]
  const procedure = results[1]
  if (
    user instanceof Error ||
    (!user.permissions.includes("ringi:procedure:manage") &&
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
      <PageHeader title="稟議の承認規程">
        <Link href="/my/ringis">稟議一覧へ</Link>
      </PageHeader>
      <p>新しく提出する稟議に適用します。提出済みの稟議には、提出時の規程が残ります。</p>
      <WorkflowEditor
        code="ringi_request"
        initial={initial}
        revision={procedure.revision}
        saveAction={saveRingiProcedureAction}
      />
    </div>
  )
}
