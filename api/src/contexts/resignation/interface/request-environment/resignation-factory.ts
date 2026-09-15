import type { ResignationContext } from "@/contexts/resignation/configuration/resignation-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type ResignationHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & ResignationContext["env"]
  Variables: SystemHonoEnv["Variables"] & ResignationContext["var"]
}>

export const resignationFactory = createFactory<ResignationHonoEnv>()
