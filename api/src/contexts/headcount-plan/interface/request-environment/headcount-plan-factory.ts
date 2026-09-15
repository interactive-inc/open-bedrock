import type { HeadcountPlanContext } from "@/contexts/headcount-plan/configuration/headcount-plan-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type HeadcountPlanHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & HeadcountPlanContext["env"]
  Variables: SystemHonoEnv["Variables"] & HeadcountPlanContext["var"]
}>

export const headcountPlanFactory = createFactory<HeadcountPlanHonoEnv>()
