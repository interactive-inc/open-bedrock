import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { updateEmployeeAction } from "@/app/(app)/company/employees/actions"
import { updatePhoneAction } from "@/app/(app)/my/settings/actions"

const mocks = vi.hoisted(() => ({ put: vi.fn(), requireAuth: vi.fn(), revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))
vi.mock("@/lib/api/hc-client", () => ({
  createClient: async () => ({
    company: {
      "employee-directory": { ":code": { $put: mocks.put } },
      "my-profile": { $put: mocks.put },
    },
  }),
}))
const initial = { ok: false, error: null }
const commandId = "12345678-1234-4abc-8def-1234567890ab"
function form() {
  const body = new FormData()
  for (const [key, value] of Object.entries({
    code: "PROFILE-001",
    name: "Changed Person",
    phone: "020-2000-2000",
    profile_employee_id: "employee:profile",
    profile_organization_revision: "7",
    profile_person_revision: "3",
    profile_effective_on: "2026-06-02",
    profile_command_id: commandId,
    reason: "本人に確認した情報へ変更",
  }))
    body.set(key, value)
  return body
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireAuth.mockResolvedValue({ permissions: ["employee:update"] })
  mocks.put.mockImplementation(() =>
    Promise.resolve(Response.json({ phone: null, code: "PROFILE-001" })),
  )
})
describe("人物情報の表示版をServerActionから引き継ぐ", () => {
  test("氏名更新は表示時の版とキーをAPIクライアントへ送る", async () => {
    expect(await updateEmployeeAction(initial, form())).toEqual({ ok: true, error: null })
    expect(mocks.put).toHaveBeenCalledWith({
      param: { code: "PROFILE-001" },
      header: { "idempotency-key": commandId },
      json: {
        name: "Changed Person",
        reason: "本人に確認した情報へ変更",
        profile: {
          employeeId: "employee:profile",
          organizationRevision: 7,
          personRevision: 3,
          effectiveOn: "2026-06-02",
        },
      },
    })
  })
  test("電話番号の空欄はnullを送り、名前などの別項目を送らない", async () => {
    const body = form()
    body.set("phone", "  ")
    expect(await updatePhoneAction(initial, body)).toEqual({ ok: true, error: null })
    expect(mocks.put).toHaveBeenCalledWith({
      header: { "idempotency-key": commandId },
      json: {
        phone: null,
        reason: "本人に確認した情報へ変更",
        profile: {
          employeeId: "employee:profile",
          organizationRevision: 7,
          personRevision: 3,
          effectiveOn: "2026-06-02",
        },
      },
    })
  })
  test.each([
    "profile_employee_id",
    "profile_organization_revision",
    "profile_person_revision",
    "profile_effective_on",
    "profile_command_id",
    "reason",
  ])("%sのないフォームでは保存しない", async (key) => {
    const body = form()
    body.delete(key)
    expect(await updateEmployeeAction(initial, body)).toMatchObject({ ok: false })
    expect(await updatePhoneAction(initial, body)).toMatchObject({ ok: false })
    expect(mocks.put).not.toHaveBeenCalled()
  })
  test("409を最新版への再送で隠さず、保存失敗後の同じフォームは同じキーを送る", async () => {
    mocks.put.mockImplementation(() =>
      Promise.resolve(Response.json({ error: "人物情報が変更されています" }, { status: 409 })),
    )
    expect(await updateEmployeeAction(initial, form())).toMatchObject({ ok: false })
    expect(mocks.put).toHaveBeenCalledTimes(1)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(await updateEmployeeAction(initial, form())).toMatchObject({ ok: false })
    expect(mocks.put.mock.calls[1]?.[0].header).toEqual({ "idempotency-key": commandId })
  })
  test("電話番号の項目自体がない送信を削除へ読み替えない", async () => {
    const body = form()
    body.delete("phone")
    expect(await updatePhoneAction(initial, body)).toMatchObject({ ok: false })
    expect(mocks.put).not.toHaveBeenCalled()
  })
})
