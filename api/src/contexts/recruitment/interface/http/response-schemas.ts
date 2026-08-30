import { z } from "zod"

/** 募集ポジション 1 件のレスポンス。 */
export const zAppRecruitmentPosition = z.object({
  id: z.number(),
  title: z.string(),
  department_code: z.string().nullable(),
  status: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 募集ポジション一覧のレスポンス。 */
export const zAppRecruitmentPositionList = z.object({
  data: z.array(zAppRecruitmentPosition),
  total: z.number(),
})

/** 応募者 1 件のレスポンス（社外個人情報。閲覧も recruitment:manage に閉じる）。 */
export const zAppRecruitmentCandidate = z.object({
  id: z.number(),
  position_id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  stage: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 応募者一覧のレスポンス。 */
export const zAppRecruitmentCandidateList = z.object({
  data: z.array(zAppRecruitmentCandidate),
  total: z.number(),
})
