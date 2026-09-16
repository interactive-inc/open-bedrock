import { describe, expect, test } from "bun:test"
import worker from "@/index"
import type { Bindings } from "@/env"

describe("Worker entrypoint", () => {
  test("HTTP handler loads the API and serves repeated requests", async () => {
    const env = {} as Bindings
    const context = {} as ExecutionContext

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await worker.fetch(
        new Request("https://example.com/system/health"),
        env,
        context,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ status: "ok" })
    }
  })
})
