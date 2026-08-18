import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { GET } from "@system/interface/routes/health"

describe("System health route", () => {
  test("認証やruntime bindingなしで稼働状態を返す", async () => {
    const app = new Hono().get("/health", ...GET)

    const response = await app.request("/health")

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"status":"ok"}')
  })
})
