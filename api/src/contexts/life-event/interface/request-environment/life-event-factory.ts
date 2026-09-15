import type { LifeEventContext } from "@/contexts/life-event/configuration/life-event-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type LifeEventHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & LifeEventContext["env"]
  Variables: SystemHonoEnv["Variables"] & LifeEventContext["var"]
}>

export const lifeEventFactory = createFactory<LifeEventHonoEnv>()
