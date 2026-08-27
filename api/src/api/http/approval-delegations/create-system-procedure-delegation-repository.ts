import type { Context } from "@/env"
import { SystemD1ProcedureDelegationAdapter } from "@system/infrastructure/adapters/workflow/system-d1-procedure-delegation.adapter"

/** Systemの委任永続化を製品API compositionへ接続する。 */
export function createSystemProcedureDelegationRepository(
  context: Context,
): SystemD1ProcedureDelegationAdapter {
  return new SystemD1ProcedureDelegationAdapter({ env: { DB: context.env.DB } })
}
