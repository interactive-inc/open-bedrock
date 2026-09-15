import type { BusinessTripContext } from "@/contexts/business-trip/configuration/business-trip-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type BusinessTripHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & BusinessTripContext["env"]
  Variables: SystemHonoEnv["Variables"] & BusinessTripContext["var"]
}>

export const businessTripFactory = createFactory<BusinessTripHonoEnv>()
