import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { loadPersonnelPositionSnapshot } from "@/app/(app)/company/employees/load-personnel-position-snapshot"
import { usePersonnelPositionSnapshot } from "@/lib/employee/use-personnel-position-snapshot"

vi.mock("@/app/(app)/company/employees/load-personnel-position-snapshot", () => ({
  loadPersonnelPositionSnapshot: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe("usePersonnelPositionSnapshot", () => {
  it("discards old choices immediately and ignores responses arriving out of order", async () => {
    const earlier =
      Promise.withResolvers<Awaited<ReturnType<typeof loadPersonnelPositionSnapshot>>>()
    const later = Promise.withResolvers<Awaited<ReturnType<typeof loadPersonnelPositionSnapshot>>>()
    vi.mocked(loadPersonnelPositionSnapshot)
      .mockReturnValueOnce(earlier.promise)
      .mockReturnValueOnce(later.promise)
    const hook = renderHook(() => usePersonnelPositionSnapshot(8))
    expect(hook.result.current.isReady).toBe(false)
    act(() => {
      void hook.result.current.changeEffectiveOn("2026-01-01")
    })
    act(() => {
      void hook.result.current.changeEffectiveOn("2026-07-01")
    })
    await act(async () => {
      later.resolve({
        ok: true,
        companyRevision: 8,
        effectiveOn: "2026-07-01",
        positions: [{ id: "position:lead", code: "LEAD", name: "Lead" }],
      })
      await later.promise
    })
    expect(hook.result.current.isReady).toBe(true)
    await act(async () => {
      earlier.resolve({
        ok: true,
        companyRevision: 8,
        effectiveOn: "2026-01-01",
        positions: [{ id: "position:old", code: "OLD", name: "Old" }],
      })
      await earlier.promise
    })
    expect(hook.result.current.positions.map((position) => position.code)).toEqual(["LEAD"])
    expect(loadPersonnelPositionSnapshot).toHaveBeenNthCalledWith(1, 8, "2026-01-01")
    expect(loadPersonnelPositionSnapshot).toHaveBeenNthCalledWith(2, 8, "2026-07-01")
    act(() => {
      void hook.result.current.changeEffectiveOn("")
    })
    expect(hook.result.current.isReady).toBe(false)
    expect(hook.result.current.positions).toEqual([])
  })

  it("does not allow stale revision, wrong date, or failed reads to authorize submission", async () => {
    const hook = renderHook(() => usePersonnelPositionSnapshot(8))
    for (const response of [
      { ok: true, companyRevision: 9, effectiveOn: "2026-01-01", positions: [] },
      { ok: true, companyRevision: 8, effectiveOn: "2026-02-01", positions: [] },
      { ok: false, error: "unavailable" },
    ] satisfies Array<Awaited<ReturnType<typeof loadPersonnelPositionSnapshot>>>) {
      vi.mocked(loadPersonnelPositionSnapshot).mockResolvedValueOnce(response)
      await act(() => hook.result.current.changeEffectiveOn("2026-01-01"))
      expect(hook.result.current.isReady).toBe(false)
      expect(hook.result.current.error).not.toBeNull()
    }
    vi.mocked(loadPersonnelPositionSnapshot).mockRejectedValueOnce(new Error("network failed"))
    await act(() => hook.result.current.changeEffectiveOn("2026-01-01"))
    expect(hook.result.current.isReady).toBe(false)
  })
})
