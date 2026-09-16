import type { RingiContext } from "@/contexts/ringi/configuration/ringi-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type RingiHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & RingiContext["env"]
  Variables: SystemHonoEnv["Variables"] & RingiContext["var"]
}>

export const ringiFactory = createFactory<RingiHonoEnv>()
