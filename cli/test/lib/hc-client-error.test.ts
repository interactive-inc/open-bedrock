import { app } from "@/app/index"
import { describe, expect, spyOn, test } from "bun:test"

// #96: hc クライアントが API のエラーレスポンス(4xx/5xx)をサイレントに成功扱いせず、
// stderr + 非ゼロ終了に落とすことを確認する。fetch をモックして API 障害を再現する。

// bun の typeof fetch は静的メソッド preconnect を要求するため、実 fetch から引き継いだ
// モックを作り、mockImplementation の型（typeof fetch）に適合させる。
function fetchReturning(status: number, body: string): typeof fetch {
  return Object.assign(() => Promise.resolve(new Response(body, { status })), {
    preconnect: fetch.preconnect,
  })
}

async function whoamiWith(status: number, body: string): Promise<Response> {
  const spy = spyOn(globalThis, "fetch").mockImplementation(fetchReturning(status, body))

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

function fetchRejecting(error: Error): typeof fetch {
  return Object.assign(() => Promise.reject(error), { preconnect: fetch.preconnect })
}

async function whoamiRejectingWith(error: Error): Promise<Response> {
  const spy = spyOn(globalThis, "fetch").mockImplementation(fetchRejecting(error))

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

  test("surfaces a JSON error body's contents in the message", async () => {
    const response = await whoamiWith(400, JSON.stringify({ message: "validation failed" }))

    expect(response.status).toBe(400)

    expect(await response.text()).toContain("validation failed")
  })

  test("passes through a successful response untouched", async () => {
    const response = await whoamiWith(200, JSON.stringify({ id: 1, name: "You Example" }))

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("You Example")
  })

  test("adds a 'karte login' hint on 401", async () => {
    const response = await whoamiWith(401, JSON.stringify({ error: "invalid token" }))

    expect(response.status).toBe(401)

    expect(await response.text()).toContain("karte login")
  })

  test("adds a permission hint on 403", async () => {
    const response = await whoamiWith(403, "forbidden")

    expect(response.status).toBe(403)

    const text = await response.text()

    expect(text).toContain("forbidden")
    expect(text).toContain("権限")
  })

  test("surfaces a connection failure with the api base url instead of a raw fetch error", async () => {
    const response = await whoamiRejectingWith(new TypeError("fetch failed"))

    expect(response.status).toBe(500)

    expect(await response.text()).toContain("接続できませんでした")
  })
})
