import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

vi.mock("@/app/(app)/system/roles/actions", () => ({ deleteRoleAction: vi.fn() }))
vi.mock("@/lib/auth/step-up-action", () => ({ stepUpAction: vi.fn() }))

import { DeleteRoleButton } from "@/app/(app)/system/roles/_components/delete-role-button"
import { deleteRoleAction } from "@/app/(app)/system/roles/actions"
import { stepUpAction } from "@/lib/auth/step-up-action"

function openConfirmDialog() {
  render(<DeleteRoleButton roleId="1" roleName="経理" />)

  fireEvent.click(screen.getByRole("button", { name: "削除" }))
}

afterEach(() => {
  cleanup()

  vi.mocked(deleteRoleAction).mockReset()

  vi.mocked(stepUpAction).mockReset()
})

describe("DeleteRoleButton", () => {
  test("再認証に成功すると同じ削除をやり直す", async () => {
    vi.mocked(deleteRoleAction).mockResolvedValue({ kind: "step_up_required" })

    vi.mocked(stepUpAction).mockResolvedValue({ ok: true, error: null })

    openConfirmDialog()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "削除する" })).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: "削除する" }))

    await waitFor(() => {
      expect(screen.getByLabelText("パスワード")).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } })

    fireEvent.click(screen.getByRole("button", { name: "確認して続行" }))

    await waitFor(() => {
      expect(vi.mocked(deleteRoleAction).mock.calls.length).toBe(2)
    })
  })

  test("拒否された理由を確認ダイアログに表示する", async () => {
    vi.mocked(deleteRoleAction).mockResolvedValue({
      kind: "failed",
      error: "割当中のロールは削除できません",
    })

    openConfirmDialog()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "削除する" })).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: "削除する" }))

    await waitFor(() => {
      expect(screen.getByText("割当中のロールは削除できません")).toBeDefined()
    })
  })
})
