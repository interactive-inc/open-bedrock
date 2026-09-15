import type { CompensationChangeContext } from "@/contexts/compensation-change/configuration/compensation-change-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type CompensationChangeHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & CompensationChangeContext["env"]
  Variables: SystemHonoEnv["Variables"] & CompensationChangeContext["var"]
}>

export const compensationChangeFactory = createFactory<CompensationChangeHonoEnv>()
