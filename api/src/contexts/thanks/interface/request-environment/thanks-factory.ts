import type { ThanksContext } from "@/contexts/thanks/configuration/thanks-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type ThanksHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & ThanksContext["env"]
  Variables: SystemHonoEnv["Variables"] & ThanksContext["var"]
}>

export const thanksFactory = createFactory<ThanksHonoEnv>()
