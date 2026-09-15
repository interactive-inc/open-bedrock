import type { SkillContext } from "@/contexts/skill/configuration/skill-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type SkillHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & SkillContext["env"]
  Variables: SystemHonoEnv["Variables"] & SkillContext["var"]
}>

export const skillFactory = createFactory<SkillHonoEnv>()
