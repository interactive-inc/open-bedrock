import type { ItIncidentContext } from "@/contexts/it-incident/configuration/it-incident-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type ItIncidentHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & ItIncidentContext["env"]
  Variables: SystemHonoEnv["Variables"] & ItIncidentContext["var"]
}>

export const itIncidentFactory = createFactory<ItIncidentHonoEnv>()
