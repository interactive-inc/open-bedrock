"use server"

import { revalidatePath } from "next/cache"
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

  if (Number.isNaN(level)) {
    return { ok: false, error: "レベルが不正です" }
  }

  const years = typeof yearsInput === "string" && yearsInput !== "" ? Number(yearsInput) : null

  if (years !== null && Number.isNaN(years)) {
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
