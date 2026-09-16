import type { RegulationContext } from "@/contexts/regulation/configuration/regulation-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type RegulationHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & RegulationContext["env"]
  Variables: SystemHonoEnv["Variables"] & RegulationContext["var"]
}>

export const regulationFactory = createFactory<RegulationHonoEnv>()
