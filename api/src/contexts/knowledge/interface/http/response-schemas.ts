import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ナレッジ記事一覧の 1 件（本文は snippet に短縮）。 */
export const zAppKnowledgeListItem = z.object({
  id: z.number(),
  category: z.string(),
  title: z.string(),
  snippet: z.string(),
  author_id: zEmployeeId,
  created_at: z.string(),
})

/** ナレッジ記事一覧のレスポンス。 */
export const zAppKnowledgeList = z.object({
  data: z.array(zAppKnowledgeListItem),
  total: z.number(),
})

/** ナレッジ記事 1 件の詳細レスポンス（GET /knowledge-articles/:id）。 */
export const zAppKnowledge = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
  author_id: zEmployeeId,
  created_at: z.string(),
})

/** ナレッジ記事の作成・更新レスポンス（POST /knowledge-articles, PUT /knowledge-articles/:id）。 */
export const zAppKnowledgeWritten = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
})
