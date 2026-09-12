import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { createEmployeeAction } from "@/app/(app)/company/employees/actions"
import { submitPersonnelAction } from "@/app/(app)/company/employees/[employee]/actions"

const mocks = vi.hoisted(() => ({ post: vi.fn(), requireAuth: vi.fn(), revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/api/hc-client", () => ({
  createClient: async () => ({
    company: {
      "employee-registrations": { $post: mocks.post },
      "personnel-action-executions": { $post: mocks.post },
      "personnel-action-requests": { $post: mocks.post },
    },
  }),
}))
const initial = { ok: false, error: null }
function form() {
  const body = new FormData()
  for (const [key, value] of Object.entries({
    code: "NEW-PT",
    name: "Example Employee",
    email: "you@example.com",
    password: "example-password-long",
    role: "member",
    hire_on: "2026-10-01",
    employment_type: "PART_TIME",
    employee_code: "E100",
    kind: "rehire",
    event_on: "2026-10-01",
    mode: "apply",
    employee_revision: "3",
    organization_revision: "2",
    company_revision: "8",
  }))
    body.set(key, value)
  return body
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireAuth.mockResolvedValue({
    permissions: [
      "employee:create",
      "employee:lifecycle:apply",
      "employee:lifecycle:request",
      "account:manage",
    ],
  })
  mocks.post.mockResolvedValue(Response.json({ code: "NEW-PT" }, { status: 201 }))
})
describe("入社と再入社で選択した雇用区分", () => {
  test("新規登録の区分を実APIクライアントへ渡す", async () => {
    expect(await createEmployeeAction(initial, form())).toEqual({ ok: true, error: null })
    expect(mocks.post).toHaveBeenCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({
          employment_type: "PART_TIME",
          expected_company_revision: 8,
        }),
      }),
      expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
    )
  })
  test.each(["apply", "request"])("再入社の区分を直接発令と承認申請へ渡す: %s", async (mode) => {
    const body = form()
    body.set("mode", mode)
    expect(await submitPersonnelAction(initial, body)).toEqual({ ok: true, error: null })
    expect(mocks.post.mock.calls[0]?.[0]).toMatchObject({
      json: {
        action: { kind: "rehire", employmentType: "PART_TIME" },
        [mode === "apply" ? "expected_company_revision" : "base_company_revision"]: 8,
      },
    })
  })
  test.each([undefined, "UNKNOWN"])("未選択・不正な区分でAPIを呼ばない: %s", async (value) => {
    const body = form()
    if (value === undefined) body.delete("employment_type")
    else body.set("employment_type", value)
    expect(await createEmployeeAction(initial, body)).toMatchObject({ ok: false })
    expect(await submitPersonnelAction(initial, body)).toMatchObject({ ok: false })
    expect(mocks.post).not.toHaveBeenCalled()
  })
})

test("確認した会社版なしでは登録・発令・承認申請を送らない", async () => {
  const body = form()
  body.delete("company_revision")
  expect(await createEmployeeAction(initial, body)).toMatchObject({ ok: false })
  for (const mode of ["apply", "request"]) {
    body.set("mode", mode)
    expect(await submitPersonnelAction(initial, body)).toMatchObject({ ok: false })
  }
  expect(mocks.post).not.toHaveBeenCalled()
})
