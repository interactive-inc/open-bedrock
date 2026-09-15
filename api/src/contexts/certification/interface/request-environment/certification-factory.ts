import type { CertificationContext } from "@/contexts/certification/configuration/certification-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type CertificationHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & CertificationContext["env"]
  Variables: SystemHonoEnv["Variables"] & CertificationContext["var"]
}>

export const certificationFactory = createFactory<CertificationHonoEnv>()
