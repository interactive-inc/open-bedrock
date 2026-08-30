import { z } from "zod"

/** スキルマスタ 1 件のレスポンス。 */
export const zAppSkill = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
})

/** スキルマスタ一覧のレスポンス。 */
export const zAppSkillList = z.object({
  data: z.array(zAppSkill),
  total: z.number(),
})

/** 本人の登録スキル 1 件のレスポンス（スキルマスタ結合済み）。 */
export const zAppEmployeeSkill = z.object({
  skill_code: z.string(),
  skill_name: z.string(),
  skill_category: z.string(),
  level: z.number(),
  years: z.number().nullable(),
  note: z.string().nullable(),
})

/** 本人の登録スキル一覧のレスポンス。 */
export const zAppEmployeeSkillList = z.object({
  data: z.array(zAppEmployeeSkill),
  total: z.number(),
})
