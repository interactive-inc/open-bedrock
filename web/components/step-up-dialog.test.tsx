import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

import { StepUpDialog } from "@/components/step-up-dialog"
import { stepUpAction } from "@/lib/auth/step-up-action"

afterEach(() => {
  cleanup()

  vi.mocked(stepUpAction).mockReset()
})

describe("StepUpDialog", () => {
  test("パスワードが違うときダイアログ内に理由を出す", async () => {
    vi.mocked(stepUpAction).mockResolvedValue({ ok: false, error: "パスワードが違います" })

    const onSucceeded = vi.fn()

    render(<StepUpDialog open={true} onSucceeded={onSucceeded} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "wrong" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(screen.getByText("パスワードが違います")).toBeDefined()
    })

    expect(onSucceeded.mock.calls.length).toBe(0)
  })

  test("再認証に成功したら呼び出し元へ知らせる", async () => {
    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    const onSucceeded = vi.fn()

    render(<StepUpDialog open={true} onSucceeded={onSucceeded} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(onSucceeded.mock.calls.length).toBe(1)
    })
  })
})
