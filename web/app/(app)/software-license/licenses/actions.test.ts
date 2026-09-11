import { beforeEach, expect, test, vi } from "vite-plus/test"
import {
  cancelLicenseAction,
  createLicenseAction,
} from "@/app/(app)/software-license/licenses/actions"

const mocks = vi.hoisted(() => ({ create: vi.fn(), cancel: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/api/create-license", () => ({ createLicense: mocks.create }))
vi.mock("@/lib/api/cancel-license", () => ({ cancelLicense: mocks.cancel }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
const initial = { ok: false, error: null }

beforeEach(() => vi.resetAllMocks())

test("a registration retry preserves the form's command key after a lost response", async () => {
  const form = new FormData()
  form.set("name", "Example Service")
  form.set("plan_name", " Team plan ")
  form.set("command_id", "registration:confirmed")
  mocks.create.mockResolvedValueOnce(new Error("応答を確認できませんでした"))
  mocks.create.mockResolvedValueOnce({ id: 1 })

  expect(await createLicenseAction(initial, form)).toMatchObject({ ok: false })
  expect(await createLicenseAction(initial, form)).toMatchObject({ ok: true })
  expect(mocks.create).toHaveBeenCalledTimes(2)
  expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1])
  expect(mocks.create.mock.calls[0]?.[1]).toBe("registration:confirmed")
  expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ plan_name: "Team plan" })
})

test("a stale cancellation does not fetch or replace the reviewed revision", async () => {
  const form = new FormData()
  form.set("id", "1")
  form.set("expected_revision", "4")
  mocks.cancel.mockResolvedValue(new Error("契約が変更されています"))

  expect(await cancelLicenseAction(initial, form)).toEqual({
    ok: false,
    error: "契約が変更されています",
  })
  expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith(1, 4)
  expect(mocks.revalidate).not.toHaveBeenCalled()
})

test("missing confirmation inputs never reach the API", async () => {
  const form = new FormData()
  form.set("id", "1")
  form.set("name", "Example Service")

  expect(await createLicenseAction(initial, form)).toMatchObject({ ok: false })
  expect(await cancelLicenseAction(initial, form)).toMatchObject({ ok: false })
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.cancel).not.toHaveBeenCalled()
})
