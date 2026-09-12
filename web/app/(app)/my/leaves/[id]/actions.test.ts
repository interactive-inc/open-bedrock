import { beforeEach, expect, test, vi } from "vite-plus/test"

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  decide: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/hc-client", () => ({
  createClient: async () => ({
    leave: {
      "leave-requests": {
        ":id": {
          submit: { $post: mocks.submit },
          procedure: {
            decisions: { $post: mocks.decide },
            complete: { $post: mocks.complete },
            cancel: { $post: mocks.cancel },
          },
        },
      },
    },
  }),
}))
vi.mock("@/lib/api/to-response-error", () => ({
  toResponseError: async () => new Error("保存時の権限が変わりました"),
}))
import { actOnLeaveProcedure } from "@/app/(app)/my/leaves/[id]/actions"

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset().mockResolvedValue({ status: 200 })
})
const target = {
  proposal_version: 2,
  proposal_digest: "a".repeat(64),
  task_key: "review",
  task_round: 3,
}

test("表示時の判断対象を保持し、最新対象の取得で置き換えない", async () => {
  const form = new FormData()
  form.set("id", "42")
  form.set("operation", "approve")
  form.set("comment", "確認済み")
  form.set("decision_target", JSON.stringify(target))
  expect(await actOnLeaveProcedure({ ok: false, error: null }, form)).toEqual({
    ok: true,
    error: null,
  })
  expect(mocks.decide).toHaveBeenCalledExactlyOnceWith({
    param: { id: "42" },
    json: { action: "approve", decision_target: target, comment: "確認済み" },
  })
  mocks.decide.mockResolvedValueOnce({ status: 403 })
  expect(await actOnLeaveProcedure({ ok: false, error: null }, form)).toEqual({
    ok: false,
    error: "保存時の権限が変わりました",
  })
})

test("再送では同じ確認digestとrequest keyを送り、不正な対象では判断しない", async () => {
  const form = new FormData()
  const key = "12345678-1234-4234-8234-123456789abc"
  form.set("id", "42")
  form.set("operation", "submit")
  form.set("request_key", key)
  form.set("confirmed_content_digest", target.proposal_digest)
  expect((await actOnLeaveProcedure({ ok: false, error: null }, form)).ok).toBe(true)
  expect((await actOnLeaveProcedure({ ok: false, error: null }, form)).ok).toBe(true)
  expect(mocks.submit).toHaveBeenCalledTimes(2)
  for (const call of mocks.submit.mock.calls)
    expect(call[0]).toEqual({
      param: { id: "42" },
      json: {
        request_key: key,
        confirmed_content_digest: target.proposal_digest,
        previous_leave_request_id: null,
      },
    })
  form.set("operation", "reject")
  form.set("decision_target", "broken")
  expect((await actOnLeaveProcedure({ ok: false, error: null }, form)).ok).toBe(false)
  expect(mocks.decide).not.toHaveBeenCalled()
})
