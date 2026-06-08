import { describe, expect, test } from "bun:test"
import { app } from "@/app"
import type { Bindings } from "@/env"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"

const jwtSecret = "app-cors-test-secret"

function makeBindings(corsOrigin?: string): Bindings {
  return {
    DB: createD1TestDatabase(loadSchema()),
    JWT_SECRET: jwtSecret,
    CORS_ORIGIN: corsOrigin,
    NOW: "2026-01-01T00:00:00.000Z",
  }
}

function preflight(origin: string, corsOrigin?: string): Promise<Response> {
  return Promise.resolve(
    app.request(
      "/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      makeBindings(corsOrigin),
    ),
  )
}

describe("CORS", () => {
  test("CORS_ORIGIN 未設定時は localhost:3000 を許可する", async () => {
    const response = await preflight("http://localhost:3000")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000")
  })

  test("CORS_ORIGIN 未設定時は localhost:5173 も許可する", async () => {
    const response = await preflight("http://localhost:5173")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173")
  })

  test("CORS_ORIGIN 未設定時は未知の Origin を許可しない", async () => {
    const response = await preflight("https://evil.example.com")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  test("CORS_ORIGIN 設定時はそのオリジンのみ許可する", async () => {
    const response = await preflight("https://app.example.com", "https://app.example.com")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })

  test("CORS_ORIGIN にカンマ区切りで複数指定すると全て許可する", async () => {
    const allowList = "https://app.example.com,https://admin.example.com"

    const responseApp = await preflight("https://app.example.com", allowList)
    expect(responseApp.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")

    const responseAdmin = await preflight("https://admin.example.com", allowList)
    expect(responseAdmin.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://admin.example.com",
    )
  })

  test("CORS_ORIGIN 設定時はリスト外の Origin を許可しない（localhost も含む）", async () => {
    const response = await preflight("http://localhost:3000", "https://app.example.com")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })
})
