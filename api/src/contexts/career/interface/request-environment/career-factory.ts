import type { CareerContext } from "@/contexts/career/configuration/career-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type CareerHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & CareerContext["env"]
  Variables: SystemHonoEnv["Variables"] & CareerContext["var"]
}>

export const careerFactory = createFactory<CareerHonoEnv>()
