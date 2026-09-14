// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { EmployeeCertificationsSection } from "./employee-certifications-section"
import { listEmployeeCertifications } from "@/lib/api/list-employee-certifications"

vi.mock("@/lib/api/list-employee-certifications", () => ({
  listEmployeeCertifications: vi.fn().mockResolvedValue([]),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("従業員の保有資格フィルター", () => {
  test("未指定時に本人の記録を自動取得しない", async () => {
    render(await EmployeeCertificationsSection({ canViewAll: true, employeeId: "" }))
    expect(listEmployeeCertifications).not.toHaveBeenCalled()
    expect(screen.getByRole("textbox", { name: "従業員 ID" })).toBeDefined()
  })

  test("指定した従業員 ID だけを API に渡す", async () => {
    render(await EmployeeCertificationsSection({ canViewAll: true, employeeId: "E001" }))
    expect(listEmployeeCertifications).toHaveBeenCalledExactlyOnceWith({ employeeId: "E001" })
  })

  test("API の拒否時に別の従業員へフォールバックしない", async () => {
    vi.mocked(listEmployeeCertifications).mockResolvedValueOnce(new Error("forbidden"))
    render(await EmployeeCertificationsSection({ canViewAll: false, employeeId: "E002" }))
    expect(listEmployeeCertifications).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("textbox", { name: "従業員 ID" })).toBeDefined()
    expect(screen.getByText("資格保有記録の取得に失敗しました")).toBeDefined()
  })
})
