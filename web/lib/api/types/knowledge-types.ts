import type { EntityId } from "@/lib/api/types/entity-id"

export type KnowledgeSearchQuery = {
  q: string | null
  category: string | null
}

export type KnowledgeSearchResult = {
  revision: number
  status: "active" | "withdrawn"
  id: EntityId
  category: string
  title: string
  snippet: string
  author_id: string
  created_at: string
}

export type KnowledgeDetailResponse = {
  revision: number
  status: "active" | "withdrawn"
  id: EntityId
  title: string
  category: string
  tags: string | null
  body_md: string
  author_id: string
  created_at: string
}

export type KnowledgeCreateRequest = {
  reason: string
  title: string
  category: string
  tags?: string | null
  body_md: string
}

export type KnowledgeUpdateRequest = {
  reason: string
  title: string
  category: string
  tags?: string | null
  body_md: string
}
