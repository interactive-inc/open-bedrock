import type { AntisocialCheckContext } from "@/contexts/antisocial-check/configuration/antisocial-check-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type AntisocialCheckHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & AntisocialCheckContext["env"]
  Variables: SystemHonoEnv["Variables"] & AntisocialCheckContext["var"]
}>

export const antisocialCheckFactory = createFactory<AntisocialCheckHonoEnv>()
