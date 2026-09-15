import type { WorkAccidentContext } from "@/contexts/work-accident/configuration/work-accident-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type WorkAccidentHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & WorkAccidentContext["env"]
  Variables: SystemHonoEnv["Variables"] & WorkAccidentContext["var"]
}>

export const workAccidentFactory = createFactory<WorkAccidentHonoEnv>()
