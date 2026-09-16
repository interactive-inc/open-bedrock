import type { RecruitmentContext } from "@/contexts/recruitment/configuration/recruitment-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type RecruitmentHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & RecruitmentContext["env"]
  Variables: SystemHonoEnv["Variables"] & RecruitmentContext["var"]
}>

export const recruitmentFactory = createFactory<RecruitmentHonoEnv>()
