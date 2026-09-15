import type { SurveyContext } from "@/contexts/survey/configuration/survey-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type SurveyHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & SurveyContext["env"]
  Variables: SystemHonoEnv["Variables"] & SurveyContext["var"]
}>

export const surveyFactory = createFactory<SurveyHonoEnv>()
