import type { PerformanceReviewContext } from "@/contexts/performance-review/configuration/performance-review-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type PerformanceReviewHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & PerformanceReviewContext["env"]
  Variables: SystemHonoEnv["Variables"] & PerformanceReviewContext["var"]
}>

export const performanceReviewFactory = createFactory<PerformanceReviewHonoEnv>()
