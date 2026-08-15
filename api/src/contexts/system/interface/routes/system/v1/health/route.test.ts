import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { GET } from "@system/interface/routes/system/v1/health/route"

describe("versioned System health route", () => {
  test("runtime bindingなしでversioned contractの稼働状態を返す", async () => {
    const app = new Hono().get("/system/v1/health", ...GET)

    const response = await app.request("/system/v1/health")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok" })
  })
})
