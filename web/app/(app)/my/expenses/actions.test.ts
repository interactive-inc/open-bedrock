import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import {
  advanceExpenseAction,
  approveExpenseAction,
  rejectExpenseAction,
  submitExpenseAction,
} from "@/app/(app)/my/expenses/actions"

const mocks = vi.hoisted(() => ({
  approve: vi.fn(),
  reject: vi.fn(),
  cancel: vi.fn(),
  execute: vi.fn(),
  submit: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn().mockResolvedValue({}) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/api/approve-expense", () => ({ approveExpense: mocks.approve }))
vi.mock("@/lib/api/reject-expense", () => ({ rejectExpense: mocks.reject }))
vi.mock("@/lib/api/cancel-expense", () => ({ cancelExpense: mocks.cancel }))
vi.mock("@/lib/api/execute-expense", () => ({ executeExpense: mocks.execute }))
vi.mock("@/lib/api/submit-expense", () => ({ submitExpense: mocks.submit }))

const target = {
  proposal_version: 3,
  proposal_digest: "a".repeat(64),
  task_key: "review",
  task_round: 2,
}
const initial = { ok: false, error: null }
function form() {
  const data = new FormData()
  data.set("expense_id", "42")
  data.set("decision_target", JSON.stringify(target))
  data.set("comment", "内容を確認しました")
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  for (const call of [mocks.approve, mocks.reject, mocks.cancel, mocks.execute, mocks.submit])
    call.mockResolvedValue({ status: "pending" })
})

describe("経費の表示内容と再送", () => {
  test.each(["approve", "reject"] as const)("表示した判断対象を送る: %s", async (operation) => {
    const action = operation === "approve" ? approveExpenseAction : rejectExpenseAction
    expect(await action(initial, form())).toEqual({ ok: true, error: null })
    expect(mocks[operation]).toHaveBeenCalledExactlyOnceWith(42, "内容を確認しました", target)
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/expense/expenses/42")
  })

  test("古い対象が拒否された場合は別の対象へ再送しない", async () => {
    mocks.approve.mockResolvedValue(new Error("判断対象が更新されました"))
    const data = form()
    expect(await approveExpenseAction(initial, data)).toEqual({
      ok: false,
      error: "判断対象が更新されました",
    })
    expect(mocks.approve).toHaveBeenCalledTimes(1)
    expect(data.get("decision_target")).toBe(JSON.stringify(target))
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  test.each(["cancel", "execute"])("取消・実行も表示した対象を保持する: %s", async (operation) => {
    const data = form()
    data.set("operation", operation)
    expect(await advanceExpenseAction(initial, data)).toEqual({ ok: true, error: null })
    expect(operation === "cancel" ? mocks.cancel : mocks.execute).toHaveBeenCalledExactlyOnceWith(
      42,
      target,
    )
  })

  test("判断対象が欠けたフォームは送信しない", async () => {
    const data = form()
    data.delete("decision_target")
    expect(await approveExpenseAction(initial, data)).toMatchObject({ ok: false })
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  test("提出失敗後も同じ再送キーと差戻し元を送る", async () => {
    const data = new FormData()
    const requestKey = "12345678-1234-4234-8234-123456789abc"
    for (const [key, value] of Object.entries({
      request_key: requestKey,
      previous_expense_id: "41",
      category: "supplies",
      spent_at: "2026-09-08",
      amount: "1000",
      note: "設備更新",
    }))
      data.set(key, value)
    data.append("attachment_id", "receipt-a")
    data.append("attachment_id", "receipt-b")
    mocks.submit.mockResolvedValueOnce(new Error("保存に失敗しました"))
    expect(await submitExpenseAction(initial, data)).toMatchObject({ ok: false })
    expect(await submitExpenseAction(initial, data)).toMatchObject({ ok: true })
    expect(mocks.submit).toHaveBeenCalledTimes(2)
    for (const call of mocks.submit.mock.calls)
      expect(call[0]).toEqual({
        request_key: requestKey,
        previous_expense_id: 41,
        existing_expense_id: null,
        category: "supplies",
        spent_at: "2026-09-08",
        attachment_ids: ["receipt-a", "receipt-b"],
        amount: 1000,
        note: "設備更新",
      })
  })
})
