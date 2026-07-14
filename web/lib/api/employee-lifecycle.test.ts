import { getEmployeeLifecycleEvents } from "@/lib/api/get-employee-lifecycle-events"
import { getEmployeeLifecycleState } from "@/lib/api/get-employee-lifecycle-state"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock("@/lib/api/hc-client", () => ({ createClient: mocks.createClient }))
afterEach(() => vi.clearAllMocks())

describe("employee lifecycle API clients", () => {
  test("loads state and timeline with no-store", async () => {
    const state = { employee_code: "E001", status: "active" }
    const events = { data: [], next_cursor: null }
    const stateGet = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(state) })
    const eventsGet = vi
      .fn()
      .mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(events) })
    mocks.createClient.mockResolvedValue({
      employees: {
        ":code": {
          "lifecycle-state": { $get: stateGet },
          "lifecycle-events": { $get: eventsGet },
        },
      },
    })
    await expect(getEmployeeLifecycleState("E001")).resolves.toEqual(state)
    await expect(getEmployeeLifecycleEvents("E001", { limit: 25 })).resolves.toEqual(events)
    expect(stateGet).toHaveBeenCalledWith(
      { param: { code: "E001" }, query: { as_of: undefined } },
      { init: { cache: "no-store" } },
    )
    expect(eventsGet).toHaveBeenCalledWith(
      {
        param: { code: "E001" },
        query: { from: undefined, to: undefined, limit: "25", cursor: undefined },
      },
      { init: { cache: "no-store" } },
    )
  })
})
