"use server"

import { revalidatePath } from "next/cache"
import { deleteMySkill } from "@/lib/api/delete-my-skill"
import { putMySkill } from "@/lib/api/put-my-skill"
import {
  FORM_CONSTRAINTS,
  toOptionalIntInRange,
  toOptionalText,
  toRequiredIntInRange,
  toRequiredText,
} from "@/lib/form/constraints"
import { requireAuth } from "@/lib/auth/require-auth"

export type SkillUpdateState = {
  ok: boolean
  error: string | null
}

// スキル登録/更新フォームの Server Action。useActionState から呼ばれる。
// 成功時は /skills/me を revalidate して一覧へ即時反映する。
export async function updateSkillAction(
  previousState: SkillUpdateState,
  formData: FormData,
): Promise<SkillUpdateState> {
  await requireAuth()

  const skillCode = toRequiredText(formData.get("skill_code"), {
    label: "スキルコード",
    max: FORM_CONSTRAINTS.skill.codeMax,
  })

  if (skillCode instanceof Error) {
    return { ok: false, error: skillCode.message }
  }

  const level = toRequiredIntInRange(formData.get("level"), {
    label: "レベル",
    min: FORM_CONSTRAINTS.skill.levelMin,
    max: FORM_CONSTRAINTS.skill.levelMax,
  })

  if (level instanceof Error) {
    return { ok: false, error: level.message }
  }

  const years = toOptionalIntInRange(formData.get("years"), {
    label: "経験年数",
    min: FORM_CONSTRAINTS.skill.yearsMin,
    max: Number.MAX_SAFE_INTEGER,
  })

  if (years instanceof Error) {
    return { ok: false, error: years.message }
  }

  const note = toOptionalText(formData.get("note"), {
    label: "メモ",
    max: FORM_CONSTRAINTS.skill.noteMax,
  })

  if (note instanceof Error) {
    return { ok: false, error: note.message }
  }

  const result = await putMySkill({
    skill_code: skillCode,
    level,
    years,
    note,
  })

  if (result instanceof Error) {
    return { ok: false, error: "スキルの保存に失敗しました" }
  }

  revalidatePath("/skills/me")

  return { ok: true, error: null }
}

// 登録スキル削除の Server Action。skill_code 必須。成功時は /skills/me を revalidate する。
export async function removeSkillAction(
  previousState: SkillUpdateState,
  formData: FormData,
): Promise<SkillUpdateState> {
  await requireAuth()

  const skillCode = formData.get("skill_code")

  if (typeof skillCode !== "string" || skillCode === "") {
    return { ok: false, error: "スキルを特定できませんでした" }
  }

  const result = await deleteMySkill(skillCode)

  if (result instanceof Error) {
    return { ok: false, error: "スキルの削除に失敗しました" }
  }

  revalidatePath("/skills/me")

  return { ok: true, error: null }
}
