import type { Context } from "@/env"
import { SystemD1ProcedureDelegationRepository } from "@system/infrastructure/workflow/system-d1-procedure-delegation.repository"

/** Systemの委任永続化を製品API compositionへ接続する。 */
export function createSystemProcedureDelegationRepository(
  context: Context,
): SystemD1ProcedureDelegationRepository {
  return new SystemD1ProcedureDelegationRepository({ env: { DB: context.env.DB } })
}
