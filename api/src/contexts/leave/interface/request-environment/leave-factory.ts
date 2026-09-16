import type { LeaveContext } from "@/contexts/leave/configuration/leave-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type LeaveHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & LeaveContext["env"]
  Variables: SystemHonoEnv["Variables"] & LeaveContext["var"]
}>

export const leaveFactory = createFactory<LeaveHonoEnv>()
