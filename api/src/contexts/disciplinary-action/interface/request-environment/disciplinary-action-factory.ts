import type { DisciplinaryActionContext } from "@/contexts/disciplinary-action/configuration/disciplinary-action-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type DisciplinaryActionHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & DisciplinaryActionContext["env"]
  Variables: SystemHonoEnv["Variables"] & DisciplinaryActionContext["var"]
}>

export const disciplinaryActionFactory = createFactory<DisciplinaryActionHonoEnv>()
