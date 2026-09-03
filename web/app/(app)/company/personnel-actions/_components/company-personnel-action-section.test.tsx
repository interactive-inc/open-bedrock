import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"

const mocks = vi.hoisted(() => ({ getCompanyPersonnelActionResources: vi.fn() }))

vi.mock("@/lib/api/get-company-personnel-action-resources", () => ({
  getCompanyPersonnelActionResources: mocks.getCompanyPersonnelActionResources,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { CompanyPersonnelActionSection } from "@/app/(app)/company/personnel-actions/_components/company-personnel-action-section"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const personnelAction: CompanyResource = {
  organizationId: "organization:default",
  type: "personnel-action",
  id: "personnel-action:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  attributes: { actionType: "transfer" },
}

describe("CompanyPersonnelActionSection", () => {
  test("発令種別と識別子を出し、発令日は有効期間として示す", async () => {
    mocks.getCompanyPersonnelActionResources.mockResolvedValue({
      organizationId: "organization:default",
      organizationRevision: 3,
      resources: [personnelAction],
    })

    render(await CompanyPersonnelActionSection())

    const rows = screen.getAllByRole("row").slice(1)

    expect(within(rows[0]).getByText("transfer")).toBeDefined()
    expect(within(rows[0]).getByText("personnel-action:1")).toBeDefined()
    expect(within(rows[0]).getByText("2026-04-01 〜")).toBeDefined()
  })

  test("空のときは登録がないことを示す", async () => {
    mocks.getCompanyPersonnelActionResources.mockResolvedValue({
      organizationId: "organization:default",
      organizationRevision: 0,
      resources: [],
    })

    render(await CompanyPersonnelActionSection())

    expect(screen.getByText("人事発令が登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getCompanyPersonnelActionResources.mockResolvedValue(new Error("failed"))

    render(await CompanyPersonnelActionSection())

    expect(screen.getByText("人事発令の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
