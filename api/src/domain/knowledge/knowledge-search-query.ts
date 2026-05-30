import { z } from "zod"

export const knowledgeSearchQuerySchema = z.object({
  q: z.string().nullable(),
  category: z.string().nullable(),
})

export type KnowledgeSearchQuery = z.infer<typeof knowledgeSearchQuerySchema>
