import Link from "next/link"
import { notFound } from "next/navigation"
import { getMe } from "@/lib/api/get-me"
import { getExpenseProcedure } from "@/lib/api/get-expense-procedure"
import { WorkflowEditor } from "@/app/(app)/system/application-templates/[template]/workflow/_components/workflow-editor"
import { saveExpenseProcedureAction } from "@/app/(app)/expense/procedure/actions"
import { PageHeader } from "@/components/page-header"
import { FetchError } from "@/components/fetch-error"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

export const metadata = { title: "経費の承認規程" }

/** 経費を受け付ける会社上の資格と必要人数を明示的に設定する。 */
export default async function ExpenseProcedurePage() {
  const results = await Promise.all([getMe(), getExpenseProcedure()])
  const user = results[0]
  const procedure = results[1]
  if (
    user instanceof Error ||
    (!user.permissions.includes("expense:procedure:manage") &&
      !user.permissions.includes("system:admin"))
  )
    notFound()
  if (procedure instanceof Error) return <FetchError message={procedure.message} />
  const initial: ApplicationWorkflow = procedure.workflow ?? {
    version: 1,
    steps: [
      {
        key: "expense_department_review",
        name: "負担部署の責任者",
        approvers: [{ type: "target_department_manager" }],
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
      <PageHeader title="経費の承認規程">
        <Link href="/my/expenses">経費一覧へ</Link>
      </PageHeader>
      <p>新しく提出する経費に適用します。提出済みの経費には、提出時の規程が残ります。</p>
      <WorkflowEditor
        code="expense_request"
        initial={initial}
        revision={procedure.revision}
        saveAction={saveExpenseProcedureAction}
      />
    </div>
  )
}
