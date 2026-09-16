import type { GovernanceContext } from "@/contexts/governance/configuration/governance-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type GovernanceRecordHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & GovernanceContext["env"]
  Variables: SystemHonoEnv["Variables"] & GovernanceContext["var"]
}>

export const governanceRecordFactory = createFactory<GovernanceRecordHonoEnv>()
