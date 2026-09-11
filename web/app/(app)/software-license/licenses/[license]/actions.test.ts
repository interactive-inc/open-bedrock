import { beforeEach, expect, test, vi } from "vite-plus/test"
import {
  assignLicenseAction,
  releaseLicenseAssignmentAction,
} from "@/app/(app)/software-license/licenses/[license]/actions"

const mocks = vi.hoisted(() => ({ assign: vi.fn(), release: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/api/assign-license", () => ({ assignLicense: mocks.assign }))
vi.mock("@/lib/api/release-license-assignment", () => ({ releaseLicenseAssignment: mocks.release }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
const initial = { ok: false, error: null }
const assignmentId = "00000000-0000-4000-8000-000000000001"
beforeEach(() => vi.resetAllMocks())

test("応答不明時の再送で利用記録IDと内容を変えない", async () => {
  const form = new FormData()
  form.set("license_id", "12")
  form.set("id", assignmentId)
  form.set("employee_id", "employee-1")
  form.set("account_reference", "")
  form.set("reason", " 業務で使用するため ")
  mocks.assign.mockResolvedValueOnce(new Error("応答不明"))
  mocks.assign.mockResolvedValueOnce({ license_id: 12 })
  expect(await assignLicenseAction(initial, form)).toEqual({ ok: false, error: "応答不明" })
  expect(mocks.revalidate).not.toHaveBeenCalled()
  expect(await assignLicenseAction(initial, form)).toEqual({ ok: true, error: null })
  expect(mocks.assign.mock.calls).toEqual([
    [
      12,
      {
        id: assignmentId,
        employee_id: "employee-1",
        account_reference: null,
        reason: "業務で使用するため",
      },
    ],
    [
      12,
      {
        id: assignmentId,
        employee_id: "employee-1",
        account_reference: null,
        reason: "業務で使用するため",
      },
    ],
  ])
  expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/software-license/licenses/12")
})

test("理由なしの開始・解除をAPIへ送らない", async () => {
  const form = new FormData()
  form.set("id", assignmentId)
  form.set("reason", "   ")
  expect(await assignLicenseAction(initial, form)).toMatchObject({ ok: false })
  expect(await releaseLicenseAssignmentAction(initial, form)).toMatchObject({ ok: false })
  expect(mocks.assign).not.toHaveBeenCalled()
  expect(mocks.release).not.toHaveBeenCalled()
})

test("解除拒否を表示し、成功時はAPIが示す契約を更新する", async () => {
  const form = new FormData()
  form.set("id", assignmentId)
  form.set("reason", "利用終了")
  form.set("license_id", "999")
  mocks.release.mockResolvedValueOnce(new Error("操作できません"))
  mocks.release.mockResolvedValueOnce({ license_id: 12 })
  expect(await releaseLicenseAssignmentAction(initial, form)).toEqual({
    ok: false,
    error: "操作できません",
  })
  expect(mocks.revalidate).not.toHaveBeenCalled()
  expect(await releaseLicenseAssignmentAction(initial, form)).toEqual({ ok: true, error: null })
  expect(mocks.release).toHaveBeenNthCalledWith(2, assignmentId, "利用終了")
  expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/software-license/licenses/12")
})
