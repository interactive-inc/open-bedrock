"use server"

import { revalidatePath } from "next/cache"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { getMe } from "@/lib/api/get-me"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"
import { updateApplicationWorkflow } from "@/lib/api/update-application-workflow"

export type WorkflowFormState = { ok: boolean; error: string | null }

export async function saveWorkflowAction(
  _previous: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const user = await getMe()
  if (user instanceof Error || canManageApplicationTemplates(user.permissions) === false) {
    return { ok: false, error: "承認フローを管理する権限がありません" }
  }
  const code = formData.get("code")
  const definition = formData.get("workflow_json")
  if (typeof code !== "string" || typeof definition !== "string") {
    return { ok: false, error: "承認フローの入力が不正です" }
  }
  let workflow: ApplicationWorkflow
  try {
    workflow = JSON.parse(definition) as ApplicationWorkflow
  } catch {
    return { ok: false, error: "詳細JSONが不正です" }
  }
  const saved = await updateApplicationWorkflow(code, workflow)
  if (saved instanceof Error) return { ok: false, error: saved.message }
  revalidatePath(`/applications/templates/${code}/workflow`)
  return { ok: true, error: null }
}
