"use server"

import { revalidatePath } from "next/cache"
import { deleteMySkill } from "@/lib/api/delete-my-skill"
import { putMySkill } from "@/lib/api/put-my-skill"

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
  const skillCode = formData.get("skill_code")

  const levelInput = formData.get("level")

  const yearsInput = formData.get("years")

  const noteInput = formData.get("note")

  if (typeof skillCode !== "string" || skillCode === "") {
    return { ok: false, error: "スキルコードを入力してください" }
  }

  if (typeof levelInput !== "string" || levelInput === "") {
    return { ok: false, error: "レベルを選択してください" }
  }

  const level = Number(levelInput)

  if (!Number.isFinite(level)) {
    return { ok: false, error: "レベルが不正です" }
  }

  const years = typeof yearsInput === "string" && yearsInput !== "" ? Number(yearsInput) : null

  if (years !== null && !Number.isFinite(years)) {
    return { ok: false, error: "経験年数が不正です" }
  }

  const note = typeof noteInput === "string" && noteInput !== "" ? noteInput : null

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
