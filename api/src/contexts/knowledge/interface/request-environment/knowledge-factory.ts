import type { KnowledgeContext } from "@/contexts/knowledge/configuration/knowledge-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type KnowledgeHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & KnowledgeContext["env"]
  Variables: SystemHonoEnv["Variables"] & KnowledgeContext["var"]
}>

export const knowledgeFactory = createFactory<KnowledgeHonoEnv>()
