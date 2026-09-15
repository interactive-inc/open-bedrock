import type { GovernanceRecordMigrationContext } from "@/contexts/governance/configuration/governance-record-migration-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type GovernanceHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & GovernanceRecordMigrationContext["env"]
  Variables: SystemHonoEnv["Variables"] & GovernanceRecordMigrationContext["var"]
}>

export const governanceFactory = createFactory<GovernanceHonoEnv>()
