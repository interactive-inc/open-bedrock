import { ConflictError } from "@/lib/errors"
import type { SystemD1Context } from "@system/configuration/system-context"

type Context = SystemD1Context

/** 経費操作がSystemへ保存する判断・実行・規程にも、元記録の停止条件を渡す。 */
export class PrepareExpenseWriteGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare() {
    return this.c.env.DB.prepare(`SELECT CASE WHEN NOT EXISTS (
      SELECT 1 FROM system_record_source_freezes WHERE owner_context='expense' AND revision=1
    ) THEN 1 ELSE json_extract('{}','expense_record_source_frozen') END`)
  }

  /** SQL本文や入力値でなく、停止trigger・最終guardが返した原因だけを変換する。 */
  failure(error: unknown): ConflictError | null {
    const visited = new Set<Error>()
    let current = error
    while (current instanceof Error && !visited.has(current)) {
      visited.add(current)
      if (
        /^(?:D1_ERROR: )?(?:expense_record_source_frozen|bad JSON path: 'expense_record_source_frozen'|JSON path error near 'expense_record_source_frozen')(?:: SQLITE_(?:ERROR|CONSTRAINT))?$/.test(
          current.message,
        )
      )
        return new ConflictError(
          "記録保全のため経費の書込みを停止しています",
          "expense_record_source_frozen",
          { cause: error },
        )
      current = current.cause
    }
    return null
  }
}
