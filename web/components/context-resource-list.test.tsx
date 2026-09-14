import { ContextResourceList } from "@/components/context-resource-list"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vite-plus/test"

afterEach(cleanup)

test("ホームは参照できるリソースだけを表示し、API定義を並べない", () => {
  render(<ContextResourceList owner="system" permissions={["batch:view"]} disabledFeatures={[]} />)
  expect(screen.getByRole("link", { name: "バッチ実行履歴" })).toBeTruthy()
  expect(screen.queryByRole("link", { name: "アカウント" })).toBeNull()
  expect(screen.queryByText("APIパスの接頭辞")).toBeNull()
  expect(screen.queryByText("CLI認可の完了")).toBeNull()
})

test("ホームでも無効化された機能を表示しない", () => {
  render(
    <ContextResourceList
      owner="system"
      permissions={["system:admin", "iam:read"]}
      disabledFeatures={["accounts"]}
    />,
  )
  expect(screen.queryByRole("link", { name: "アカウント" })).toBeNull()
})
