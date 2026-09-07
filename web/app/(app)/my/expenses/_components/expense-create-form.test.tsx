import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ExpenseCreateForm } from "@/app/(app)/my/expenses/_components/expense-create-form"

const mocks = vi.hoisted(() => ({ submit: vi.fn(), upload: vi.fn(), push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/(app)/my/expenses/actions", () => ({ submitExpenseAction: mocks.submit }))
vi.mock("@/app/(app)/my/expenses/upload-attachments-action", () => ({
  uploadExpenseAttachmentsAction: mocks.upload,
}))
beforeEach(() => {
  vi.resetAllMocks()
})
afterEach(cleanup)

const initial = {
  id: 42,
  category: "supplies" as const,
  amount: 500,
  spent_at: "2026-09-08",
  note: "Receipt",
  attachments: [],
}

test("結果不明後も本文・添付ID・再送キーを維持して同じ申請を再試行する", async () => {
  const sent: Array<Array<[string, FormDataEntryValue]>> = []
  mocks.submit.mockImplementation(async (_previous, form: FormData) => {
    sent.push([...form.entries()])
    return { ok: false, error: "結果を確認できません" }
  })
  render(
    <ExpenseCreateForm
      requestKey="request-key"
      initial={{
        ...initial,
        attachments: [
          {
            id: "receipt-id",
            file_name: "receipt.pdf",
            content_type: "application/pdf",
            byte_size: 50,
          },
        ],
      }}
      mode="resubmit"
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "承認規程へ提出" }))
  await screen.findByRole("button", { name: "同じ内容で再試行" })
  fireEvent.click(screen.getByRole("button", { name: "同じ内容で再試行" }))
  await waitFor(() => expect(sent).toHaveLength(2))
  expect(Object.fromEntries(sent[0]!)).toMatchObject({
    request_key: "request-key",
    previous_expense_id: "42",
    attachment_id: "receipt-id",
    category: "supplies",
    amount: "500",
    spent_at: "2026-09-08",
    note: "Receipt",
  })
  expect(Object.fromEntries(sent[1]!)).toEqual(Object.fromEntries(sent[0]!))
  expect(mocks.upload).not.toHaveBeenCalled()
  expect(mocks.push).not.toHaveBeenCalled()
})

test("複数添付の途中失敗で成功済みIDを維持し、確認するまで経費を提出しない", async () => {
  mocks.upload
    .mockResolvedValueOnce({
      uploaded: [
        { id: "first-id", file_name: "first.pdf", content_type: "application/pdf", byte_size: 10 },
      ],
      error: null,
    })
    .mockResolvedValueOnce({ uploaded: [], error: "二つ目を預けられません" })
  const { container } = render(
    <ExpenseCreateForm requestKey="request-key" initial={initial} mode="resubmit" />,
  )
  fireEvent.change(screen.getByLabelText("領収書（任意）"), {
    target: { files: [new File(["first"], "first.pdf"), new File(["second"], "second.pdf")] },
  })
  await screen.findByText("二つ目を預けられません")
  expect(mocks.upload).toHaveBeenCalledTimes(2)
  for (const call of mocks.upload.mock.calls) expect(call[0].getAll("files")).toHaveLength(1)
  expect(container.querySelector<HTMLInputElement>('input[name="attachment_id"]')?.value).toBe(
    "first-id",
  )
  expect(
    (screen.getByRole("button", { name: "承認規程へ提出" }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect(mocks.submit).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "添付の選択をやり直す" }))
  expect(
    (screen.getByRole("button", { name: "承認規程へ提出" }) as HTMLButtonElement).disabled,
  ).toBe(false)
})
