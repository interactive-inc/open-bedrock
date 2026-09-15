import type { TrainingContext } from "@/contexts/training/configuration/training-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type TrainingHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & TrainingContext["env"]
  Variables: SystemHonoEnv["Variables"] & TrainingContext["var"]
}>

export const trainingFactory = createFactory<TrainingHonoEnv>()
