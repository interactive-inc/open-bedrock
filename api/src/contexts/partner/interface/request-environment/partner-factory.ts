import type { PartnerContext } from "@/contexts/partner/configuration/partner-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type PartnerHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & PartnerContext["env"]
  Variables: SystemHonoEnv["Variables"] & PartnerContext["var"]
}>

export const partnerFactory = createFactory<PartnerHonoEnv>()
