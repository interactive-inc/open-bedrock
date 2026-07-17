import { NextRequest } from "next/server"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

const mocks = vi.hoisted(() => ({ postRefreshToken: vi.fn() }))
vi.mock("@/lib/api/post-refresh-token", () => ({ postRefreshToken: mocks.postRefreshToken }))

import { proxy } from "@/proxy"

afterEach(() => vi.clearAllMocks())

describe("session refresh proxy", () => {
  test("lets the local export Route Handler return the unauthenticated API response", async () => {
    const response = await proxy(
      new NextRequest(
        "https://karte.open.localhost/admin/audit-events/export?from=2026-07-01T00%3A00%3A00Z&to=2026-07-02T00%3A00%3A00Z",
      ),
    )
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  test("keeps the current URL when no session or refresh token exists", async () => {
    const response = await proxy(new NextRequest("https://karte.open.localhost/admin/audit-events"))
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
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

  test("injects a refreshed session into the same request without redirecting", async () => {
    mocks.postRefreshToken.mockResolvedValue({
      access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJFMDExIiwiZXhwIjo0MTAyNDQ0ODAwfQ.signature",
      refresh_token: "rotated-refresh-token",
    })
    const request = new NextRequest("https://karte.open.localhost/employees?status=active")
    request.cookies.set("refresh_token", "fixture")

    const response = await proxy(request)

    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-request-cookie")).toContain("session=")
    expect(response.cookies.get("session")?.value).toContain("eyJhbGciOiJIUzI1NiJ9")
    expect(response.cookies.get("refresh_token")?.value).toBe("rotated-refresh-token")
  })
})
