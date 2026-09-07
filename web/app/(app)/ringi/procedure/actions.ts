"use server"

import { revalidatePath } from "next/cache"
import { publishRingiProcedure } from "@/lib/api/publish-ringi-procedure"
import { parseWorkflowDefinitionJson } from "@/app/(app)/system/application-templates/[template]/workflow/_lib/workflow-definition"
import type { WorkflowFormState } from "@/app/(app)/system/application-templates/[template]/workflow/actions"

/** 確認した規程の版を稟議専用の設定権限で保存する。 */
export async function saveRingiProcedureAction(
  previous: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const definition = formData.get("workflow_json")
  const revision = Number(formData.get("expected_revision"))
  if (typeof definition !== "string" || !Number.isSafeInteger(revision) || revision < 0)
    return { ...previous, ok: false, error: "承認規程の入力が不正です" }
  const parsed = parseWorkflowDefinitionJson(definition)
  if (!parsed.success) return { ...previous, ok: false, error: parsed.error }
  const saved = await publishRingiProcedure(parsed.workflow, revision)
  if (saved instanceof Error) return { ...previous, ok: false, error: saved.message }
  revalidatePath("/ringi/procedure")
  revalidatePath("/my/ringis/new")
  return { ok: true, error: null, revision: saved.revision }
}
