import type { CommendationContext } from "@/contexts/commendation/configuration/commendation-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type CommendationHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & CommendationContext["env"]
  Variables: SystemHonoEnv["Variables"] & CommendationContext["var"]
}>

export const commendationFactory = createFactory<CommendationHonoEnv>()
