import type { OneOnOneContext } from "@/contexts/one-on-one/configuration/one-on-one-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type OneOnOneHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & OneOnOneContext["env"]
  Variables: SystemHonoEnv["Variables"] & OneOnOneContext["var"]
}>

export const oneOnOneFactory = createFactory<OneOnOneHonoEnv>()
