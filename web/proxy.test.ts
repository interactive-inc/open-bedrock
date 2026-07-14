import { NextRequest } from "next/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

const mocks = vi.hoisted(() => ({ postRefreshToken: vi.fn() }))
vi.mock("@/lib/api/post-refresh-token", () => ({ postRefreshToken: mocks.postRefreshToken }))

import { proxy } from "@/proxy"

afterEach(() => vi.clearAllMocks())

describe("proxy audit export boundary", () => {
  test("lets the local export Route Handler return the unauthenticated API response", async () => {
    const response = await proxy(
      new NextRequest(
        "https://karte.open.localhost/admin/audit-events/export?from=2026-07-01T00%3A00%3A00Z&to=2026-07-02T00%3A00%3A00Z",
      ),
    )
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  test("keeps ordinary protected pages redirected to login", async () => {
    const response = await proxy(new NextRequest("https://karte.open.localhost/admin/audit-events"))
    expect(response.headers.get("location")).toBe("https://karte.open.localhost/login")
  })

  test("does not turn an invalid refresh token on the export route into HTML navigation", async () => {
    mocks.postRefreshToken.mockResolvedValue(new Error("invalid refresh"))
    const request = new NextRequest("https://karte.open.localhost/admin/audit-events/export")
    request.cookies.set("refresh_token", "fixture")
    const response = await proxy(request)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(mocks.postRefreshToken).toHaveBeenCalledWith("fixture")
  })
})
