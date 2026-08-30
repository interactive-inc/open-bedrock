import { z } from "zod"

/** 規程集一覧の 1 件（最新版のメタ情報を含む）。 */
export const zAppRegulationListItem = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  latest_version: z.number().nullable(),
  effective_on: z.string().nullable(),
  created_at: z.string(),
})

/** 規程集一覧のレスポンス。 */
export const zAppRegulationList = z.object({
  data: z.array(zAppRegulationListItem),
  total: z.number(),
})

/** 規程の改定版 1 件。 */
export const zAppRegulationVersion = z.object({
  id: z.number(),
  version: z.number(),
  body_md: z.string(),
  effective_on: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 規程 1 件の詳細（最新版＋版一覧）。 */
export const zAppRegulationDetail = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  latest_version: zAppRegulationVersion.nullable(),
  versions: z.array(zAppRegulationVersion),
})

/** 規程の新規登録・新版追加・アーカイブのレスポンス（規程本体のメタ）。 */
export const zAppRegulation = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})
