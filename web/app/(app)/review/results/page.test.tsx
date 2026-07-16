import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import ReviewResultsPage from "@/app/(app)/review/results/page"
import type { ReactElement, ReactNode } from "react"

const mocks = vi.hoisted(() => ({
  getReviewResults: vi.fn(),
}))

vi.mock("@/lib/api/get-review-results", () => ({
  getReviewResults: mocks.getReviewResults,
}))
vi.mock("@/components/fetch-error", () => ({
  FetchError: ({ message }: { message: string }) => <p>{message}</p>,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ReviewResultsPage", () => {
  test("lets a non-admin saved participant reach the API-scoped result", async () => {
    mocks.getReviewResults.mockResolvedValue({
      cycle_id: 2,
      subject_employee_id: 5,
      form_count: 1,
      submitted_count: 1,
      average_score: 80,
      forms: [
        {
          id: 3,
          cycle_id: 2,
          subject_employee_id: 5,
          reviewer_employee_id: 4,
          reviewer_type: "manager",
          answers: ["Own submitted answer"],
          score: 80,
          status: "submitted",
          submitted_at: "2025-12-20T00:00:00Z",
        },
      ],
    })

    await renderResults({ cycle_id: "2", employee_code: "E005" })

    expect(await screen.findByText("平均スコア: 80")).toBeTruthy()
    expect(mocks.getReviewResults).toHaveBeenCalledWith({ cycleId: 2, employeeCode: "E005" })
  })

  test("keeps an unauthorized API response denied", async () => {
    mocks.getReviewResults.mockResolvedValue(new Error("forbidden"))

    await renderResults({ cycle_id: "2", employee_code: "E005" })

    expect(await screen.findByText("評価結果の取得に失敗しました")).toBeTruthy()
  })
})

async function renderResults(searchParams: Record<string, string>): Promise<void> {
  const page = (await ReviewResultsPage({
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{
    children: ReactNode
  }>
  const [, suspense] = page.props.children as ReadonlyArray<ReactElement<{ children: ReactNode }>>
  const results = suspense.props.children as ReactElement<Record<string, unknown>>
  const renderResultsComponent = results.type as (
    props: Record<string, unknown>,
  ) => Promise<ReactElement>

  render(await renderResultsComponent(results.props))
}
