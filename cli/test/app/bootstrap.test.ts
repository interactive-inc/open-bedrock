import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

function postBootstrap(body: Record<string, unknown>): Promise<Response> {
  return Promise.resolve(
    app.request("/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

describe("bootstrap command", () => {
  it("POST /bootstrap is reachable and returns its help", async () => {
    const response = await postBootstrap({ help: "1" })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("karte bootstrap")
  })

  it("requires --email, --password, and --name", async () => {
    const response = await postBootstrap({ email: "root@example.com" })

    expect(response.status).not.toBe(200)
  })

  it("requires a token via --token or BOOTSTRAP_TOKEN", async () => {
    const previous = process.env.BOOTSTRAP_TOKEN
    delete process.env.BOOTSTRAP_TOKEN

    try {
      const response = await postBootstrap({
        email: "root@example.com",
        password: "Passw0rd",
        name: "Root Admin",
      })

      expect(response.status).not.toBe(200)
    } finally {
      if (previous !== undefined) {
        process.env.BOOTSTRAP_TOKEN = previous
      }
    }
  })
})
