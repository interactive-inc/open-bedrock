import { afterEach, expect, test, vi } from "vite-plus/test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LeaveInboxDecisionForm } from "@/app/(app)/inbox/leaves/_components/leave-inbox-decision-form"
import type { LeaveRequestInboxResponse } from "@/lib/api/types/leave-types"

vi.mock("@/app/(app)/inbox/leaves/actions", () => ({
  decideLeaveRequestAction: vi
    .fn()
    .mockResolvedValue({ ok: false, error: "申請内容を確認し直してください" }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
afterEach(cleanup)
const request: LeaveRequestInboxResponse = {
  id: 42,
  employee_id: "member" as LeaveRequestInboxResponse["employee_id"],
  applicant_name: "申請者",
  leave_type: "annual",
  start_date: "2026-06-20",
  end_date: "2026-06-20",
  days: 1,
  unit: "hourly",
  hours: 2,
  consumed_days: 0.25,
  reason: "確認前の理由",
  status: "pending",
  created_at: "2026-06-01T00:00:00Z",
  decision_target: { request_id: 42, request_digest: "a".repeat(64) },
}

test("確認画面で内容と消費日数を示し、再描画でも開いた内容を保持する", async () => {
  const view = render(<LeaveInboxDecisionForm request={request} />)
  expect(screen.queryByRole("button", { name: "承認" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "内容を確認" }))
  await screen.findByRole("dialog", { name: "休暇申請の確認" })
  for (const text of [
    "申請者（member）",
    "2026-06-20 〜 2026-06-20",
    "時間休",
    "2 時間",
    "0.25 日",
    "確認前の理由",
  ])
    expect(screen.getByText(text)).toBeTruthy()
  const input = document.querySelector<HTMLInputElement>('input[name="decision_target"]')!
  expect(JSON.parse(input.value)).toEqual(request.decision_target)
  const changed = {
    ...request,
    reason: "更新後の理由",
    decision_target: { ...request.decision_target, request_digest: "b".repeat(64) },
  }
  view.rerender(<LeaveInboxDecisionForm request={changed} />)
  expect(screen.getByText("確認前の理由")).toBeTruthy()
  expect(screen.queryByText("更新後の理由")).toBeNull()
  expect(JSON.parse(input.value)).toEqual(request.decision_target)
  fireEvent.click(screen.getByRole("button", { name: "閉じる" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  fireEvent.click(screen.getByRole("button", { name: "内容を確認" }))
  await screen.findByText("更新後の理由")
  expect(
    JSON.parse(document.querySelector<HTMLInputElement>('input[name="decision_target"]')!.value),
  ).toEqual(changed.decision_target)
})
