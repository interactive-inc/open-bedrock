import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { submitExpense } from "@/lib/api/submit-expense"

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock("@/lib/api/hc-client", () => ({ createClient: mocks.createClient }))

afterEach(() => vi.clearAllMocks())

describe("submitExpense", () => {
  test("sends entity ids as the UUID strings the API declares", async () => {
    const post = vi.fn().mockResolvedValue({
      status: 201,
      json: async () => ({ id: "0190004e-0000-7000-8000-000000000029" }),
    })
    mocks.createClient.mockResolvedValue({ expense: { expenses: { $post: post } } })
    const request = {
      request_key: "12345678-1234-4234-8234-123456789abc",
      category: "supplies" as const,
      amount: 1000,
      spent_at: "2026-09-08",
      note: "設備更新",
      attachment_ids: [],
    }

    await submitExpense({
      ...request,
      existing_expense_id: null,
      previous_expense_id: "0190004e-0000-7000-8000-000000000029",
    })

    expect(post).toHaveBeenCalledExactlyOnceWith({
      json: {
        ...request,
        existing_expense_id: null,
        previous_expense_id: "0190004e-0000-7000-8000-000000000029",
      },
    })
  })
})
