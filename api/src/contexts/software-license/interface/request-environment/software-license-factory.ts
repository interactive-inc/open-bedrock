import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type SoftwareLicenseHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & SoftwareLicenseContext["env"]
  Variables: SystemHonoEnv["Variables"] & SoftwareLicenseContext["var"]
}>

export const softwareLicenseFactory = createFactory<SoftwareLicenseHonoEnv>()
