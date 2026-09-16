import type { ShiftContext } from "@/contexts/shift/configuration/shift-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type ShiftHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & ShiftContext["env"]
  Variables: SystemHonoEnv["Variables"] & ShiftContext["var"]
}>

export const shiftFactory = createFactory<ShiftHonoEnv>()
