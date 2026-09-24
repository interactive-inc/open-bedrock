import { describe, expect, test } from "bun:test"
import { PrepareExpenseWriteGuardAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-write-guard.adapter"
import { ConflictError } from "@/lib/errors"
import type { SystemD1Context } from "@system/configuration/system-context"

// failure() はDBへ触れないため、DBの無いContextで検証する。
const adapter = new PrepareExpenseWriteGuardAdapter({ env: {} } as SystemD1Context)

describe("PrepareExpenseWriteGuardAdapter.failure", () => {
  test.each([
    "expense_record_source_frozen",
    "D1_ERROR: expense_record_source_frozen: SQLITE_CONSTRAINT",
    "D1_ERROR: expense_record_source_frozen: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)",
    "bad JSON path: 'expense_record_source_frozen'",
  ])("停止triggerとguardの拒否を409へ変換する: %s", (message) => {
    const failure = adapter.failure(new Error("Failed query", { cause: new Error(message) }))

    expect(failure).toBeInstanceOf(ConflictError)
    expect(failure?.code).toBe("expense_record_source_frozen")
  })

  test.each([
    "D1_ERROR: UNIQUE constraint failed: expense_budgets.id: SQLITE_CONSTRAINT",
    "D1_ERROR: expense_record_source_frozen: SQLITE_CONSTRAINT (extended: not a code)",
    "expense_record_source_frozen appears inside another message",
  ])("停止以外の失敗は変換しない: %s", (message) => {
    expect(adapter.failure(new Error(message))).toBeNull()
  })
})
