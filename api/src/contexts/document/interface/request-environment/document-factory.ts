import type { DocumentContext } from "@/contexts/document/configuration/document-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type DocumentHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & DocumentContext["env"]
  Variables: SystemHonoEnv["Variables"] & DocumentContext["var"]
}>

export const documentFactory = createFactory<DocumentHonoEnv>()
