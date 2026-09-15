import type { FamilyCareLeaveContext } from "@/contexts/family-care-leave/configuration/family-care-leave-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type FamilyCareLeaveHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & FamilyCareLeaveContext["env"]
  Variables: SystemHonoEnv["Variables"] & FamilyCareLeaveContext["var"]
}>

export const familyCareLeaveFactory = createFactory<FamilyCareLeaveHonoEnv>()
