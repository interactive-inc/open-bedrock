import { beforeEach, expect, test, vi } from "vite-plus/test"
const mocks = vi.hoisted(() => ({ publish: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/api/publish-leave-procedure", () => ({ publishLeaveProcedure: mocks.publish }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { saveLeaveProcedureAction } from "@/app/(app)/leave/procedure/actions"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.publish.mockResolvedValue({ revision: 4 })
})
const initial = { ok: false, error: null, revision: 3 }
const workflow = {
  version: 1,
  steps: [{ key: "review", name: "Review", approvers: [{ type: "direct_manager" }] }],
}

test.each([null, "", "-1", "3.5"])(
  "確認した規程版がない場合は保存APIを呼ばない: %s",
  async (revision) => {
    const form = new FormData()
    form.set("workflow_json", JSON.stringify(workflow))
    if (revision !== null) form.set("expected_revision", revision)
    expect((await saveLeaveProcedureAction(initial, form)).ok).toBe(false)
    expect(mocks.publish).not.toHaveBeenCalled()
  },
)

test("表示された規程版で保存し、競合時は元の版を保持する", async () => {
  const form = new FormData()
  form.set("workflow_json", JSON.stringify(workflow))
  form.set("expected_revision", "3")
  mocks.publish.mockResolvedValueOnce(new Error("revision conflict"))
  expect(await saveLeaveProcedureAction(initial, form)).toEqual({
    ...initial,
    error: "revision conflict",
  })
  expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }), 3)
  expect(await saveLeaveProcedureAction(initial, form)).toEqual({
    ok: true,
    error: null,
    revision: 4,
  })
  expect(mocks.publish).toHaveBeenLastCalledWith(expect.objectContaining({ version: 1 }), 3)
})
