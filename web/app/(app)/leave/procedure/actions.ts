"use server"

import { revalidatePath } from "next/cache"
import { publishLeaveProcedure } from "@/lib/api/publish-leave-procedure"
import { parseWorkflowDefinitionJson } from "@/app/(app)/system/application-templates/[template]/workflow/_lib/workflow-definition"
import type { WorkflowFormState } from "@/app/(app)/system/application-templates/[template]/workflow/actions"

/** 確認した規程の版を休暇専用の設定権限で保存する。 */
export async function saveLeaveProcedureAction(
  previous: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const definition = formData.get("workflow_json")
  const rawRevision = formData.get("expected_revision")
  if (typeof rawRevision !== "string" || !/^(0|[1-9]\d*)$/.test(rawRevision))
    return { ...previous, ok: false, error: "確認した規程の版を指定してください" }
  const revision = Number(rawRevision)
  if (typeof definition !== "string" || !Number.isSafeInteger(revision) || revision < 0)
    return { ...previous, ok: false, error: "承認規程の入力が不正です" }
  const parsed = parseWorkflowDefinitionJson(definition)
  if (!parsed.success) return { ...previous, ok: false, error: parsed.error }
  const saved = await publishLeaveProcedure(parsed.workflow, revision)
  if (saved instanceof Error) return { ...previous, ok: false, error: saved.message }
  revalidatePath("/leave/procedure")
  revalidatePath("/my/leaves/new")
  return { ok: true, error: null, revision: saved.revision }
}
