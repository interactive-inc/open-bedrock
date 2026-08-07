"use server"

import { revalidatePath } from "next/cache"
import { createDepartmentDefinition } from "@/lib/api/create-department-definition"
import { getMe } from "@/lib/api/get-me"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { toRequiredText } from "@/lib/form/to-required-text"
import { canManageOrg } from "@/lib/org/can-manage-org"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type DepartmentDefinitionActionState = {
  ok: boolean
  error: string | null
}

/** 部署マスタ作成 Server Action。name 必須。同名の重複は api が 409 を返す。 */
export async function createDepartmentDefinitionAction(
  previousState: DepartmentDefinitionActionState,
  formData: FormData,
): Promise<DepartmentDefinitionActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageOrg(currentUser.permissions) === false) {
    return { ok: false, error: "組織を管理する権限がありません" }
  }

  const name = toRequiredText(formData.get("name"), {
    label: "部署名",
    max: FORM_CONSTRAINTS.departmentDefinition.nameMax,
  })

  if (name instanceof Error) {
    return { ok: false, error: name.message }
  }

  const created = await createDepartmentDefinition({ name })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/departments/definitions")

  revalidatePath("/organization/departments/new")

  return { ok: true, error: null }
}
