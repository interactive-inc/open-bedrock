import type { HealthCheckupContext } from "@/contexts/health-checkup/configuration/health-checkup-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type HealthCheckupHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & HealthCheckupContext["env"]
  Variables: SystemHonoEnv["Variables"] & HealthCheckupContext["var"]
}>

export const healthCheckupFactory = createFactory<HealthCheckupHonoEnv>()
