import { app } from "@/app/index"
import { describe, expect, spyOn, test } from "bun:test"

// #96: hc クライアントが API のエラーレスポンス(4xx/5xx)をサイレントに成功扱いせず、
// stderr + 非ゼロ終了に落とすことを確認する。fetch をモックして API 障害を再現する。

async function whoamiWith(status: number, body: string): Promise<Response> {
  const spy = spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(new Response(body, { status })),
  )

  try {
    return await app.request("/whoami", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
  } finally {
    spy.mockRestore()
  }
}

describe("hc client error handling (#96)", () => {
  test("surfaces a 4xx API error instead of returning it as success", async () => {
    const response = await whoamiWith(403, "forbidden")

    // onError が ApiError(403) を stderr へ落とすため、200 ではなく 403 になる。
    expect(response.status).toBe(403)

    expect(await response.text()).toContain("forbidden")
  })

  test("surfaces a 5xx API error", async () => {
    const response = await whoamiWith(500, "boom")

    expect(response.status).toBe(500)
  })

  test("passes through a successful response untouched", async () => {
    const response = await whoamiWith(200, JSON.stringify({ id: 1, name: "You Example" }))

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("You Example")
  })
})
