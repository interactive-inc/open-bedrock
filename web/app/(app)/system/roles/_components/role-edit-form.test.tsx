import { render } from "@testing-library/react"
import { describe, expect, test, vi } from "vite-plus/test"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/app/(app)/system/roles/actions", () => ({ updateRoleAction: vi.fn() }))

import { RoleEditForm } from "@/app/(app)/system/roles/_components/role-edit-form"

const permissions = [
  { key: "employee:read", description: "従業員を閲覧する", category: "employee" },
  { key: "expense:approve", description: "経費申請を承認・却下する", category: "expense" },
]

function toSubmittedPermissionKeys(container: HTMLElement): ReadonlyArray<string> {
  const inputs = container.querySelectorAll<HTMLInputElement>('input[name="permission_keys"]')

  return [...inputs]
    .filter((input) => input.type === "hidden" || input.checked)
    .map((input) => input.value)
}

describe("RoleEditForm", () => {
  test("付与済みの権限にcheckboxを入れる", () => {
    const { container } = render(
      <RoleEditForm
        roleId="1"
        name="経理"
        description={null}
        grantedPermissionKeys={["expense:approve"]}
        permissions={permissions}
      />,
    )

    expect(toSubmittedPermissionKeys(container)).toEqual(["expense:approve"])
  })

  test("画面に出ない付与済み権限をhiddenで持ち越す", () => {
    // 無効なAppの権限や操作者が持たない権限はcheckboxが無い。
    // 送信対象から落ちると保存のたびに黙って剥がれるため hidden で残す。
    const { container } = render(
      <RoleEditForm
        roleId="1"
        name="経理"
        description={null}
        grantedPermissionKeys={["expense:approve", "goal:read:all", "thanks_reward:manage"]}
        permissions={permissions}
      />,
    )

    expect(toSubmittedPermissionKeys(container).toSorted()).toEqual([
      "expense:approve",
      "goal:read:all",
      "thanks_reward:manage",
    ])
  })

  test("外した権限はhiddenで復活させない", () => {
    const { container } = render(
      <RoleEditForm
        roleId="1"
        name="経理"
        description={null}
        grantedPermissionKeys={[]}
        permissions={permissions}
      />,
    )

    expect(toSubmittedPermissionKeys(container)).toEqual([])
  })
})
