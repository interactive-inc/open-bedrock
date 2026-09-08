import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { decideLeaveRequestAction } from "@/app/(app)/inbox/leaves/actions"

const mocks = vi.hoisted(() => ({
  approve: vi.fn(),
  reject: vi.fn(),
  getMe: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/api/get-me", () => ({ getMe: mocks.getMe }))
vi.mock("@/lib/api/approve-leave-request", () => ({ approveLeaveRequest: mocks.approve }))
vi.mock("@/lib/api/reject-leave-request", () => ({ rejectLeaveRequest: mocks.reject }))
const target = { request_id: 42, request_digest: "a".repeat(64) }
const initial = { ok: false, error: null }
function form(operation = "approve") {
  const data = new FormData()
  data.set("leave_request_id", "42")
  data.set("decision_target", JSON.stringify(target))
  data.set("decision", operation)
  data.set("comment", " 内容を確認しました ")
  return data
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getMe.mockResolvedValue({ permissions: ["leave:approve"] })
  mocks.approve.mockResolvedValue({ status: "approved" })
  mocks.reject.mockResolvedValue({ status: "rejected" })
})
describe("休暇判断の確認対象", () => {
  test.each(["approve", "reject"] as const)("確認した対象を一度だけ渡す: %s", async (operation) => {
    expect(await decideLeaveRequestAction(initial, form(operation))).toEqual({
      ok: true,
      error: null,
    })
    expect(mocks[operation]).toHaveBeenCalledExactlyOnceWith(42, "内容を確認しました", target)
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inbox/leaves")
  })
  test.each([
    undefined,
    "broken",
    "null",
    "{}",
    JSON.stringify({ ...target, request_id: 43 }),
    JSON.stringify({ ...target, request_digest: "bad" }),
  ])("確認対象が不正な場合は送信しない: %s", async (value) => {
    const data = form()
    if (value === undefined) data.delete("decision_target")
    else data.set("decision_target", value)
    expect(await decideLeaveRequestAction(initial, data)).toMatchObject({ ok: false })
    expect(mocks.approve).not.toHaveBeenCalled()
    expect(mocks.reject).not.toHaveBeenCalled()
  })
  test.each(["approve", "reject"] as const)(
    "更新済みの対象を別内容へ自動差し替えしない: %s",
    async (operation) => {
      mocks[operation].mockResolvedValue(new Error("申請内容を確認し直してください"))
      const data = form(operation)
      expect(await decideLeaveRequestAction(initial, data)).toEqual({
        ok: false,
        error: "申請内容を確認し直してください",
      })
      expect(mocks[operation]).toHaveBeenCalledExactlyOnceWith(42, "内容を確認しました", target)
      expect(data.get("decision_target")).toBe(JSON.stringify(target))
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    },
  )
  test("権限を持たない場合は送信しない", async () => {
    mocks.getMe.mockResolvedValue({ permissions: [] })
    expect(await decideLeaveRequestAction(initial, form())).toMatchObject({ ok: false })
    expect(mocks.approve).not.toHaveBeenCalled()
  })
  test("却下理由の空白を拒否する", async () => {
    const data = form("reject")
    data.set("comment", "   ")
    expect(await decideLeaveRequestAction(initial, data)).toMatchObject({ ok: false })
    expect(mocks.reject).not.toHaveBeenCalled()
  })
})
