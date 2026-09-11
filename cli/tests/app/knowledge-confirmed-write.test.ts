import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "knowledge-confirmed-cli-"))
beforeAll(() => {
  process.env.BEDROCK_CONFIG_DIR = directory
})
afterAll(() => {
  if (originalConfig === undefined) delete process.env.BEDROCK_CONFIG_DIR
  else process.env.BEDROCK_CONFIG_DIR = originalConfig
  rmSync(directory, { recursive: true, force: true })
})
const key = "12345678-1234-4abc-8def-1234567890ab"
const input = {
  id: "12",
  title: "Recorded procedure",
  category: "Operations",
  body: "Current instructions",
  reason: "Correct outdated instructions",
  revision: "17",
  "idempotency-key": key,
}
function post(operation: string, body: unknown) {
  return app.request(`/knowledge-articles/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("knowledge CLI preserves confirmed revision and retry identity", () => {
  for (const operation of ["add", "edit", "withdraw"]) {
    test(`${operation}: 指定した版・理由・再送キーをそのままAPIへ送り、最新版を取り直さない`, async () => {
      const requests: Request[] = []
      const interception = spyOn(globalThis, "fetch").mockImplementation(
        Object.assign(
          async (target: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
            const request =
              target instanceof Request
                ? new Request(target, init)
                : new Request(String(target), init)
            requests.push(request)
            expect(new URL(request.url).pathname).toBe(
              operation === "add"
                ? "/knowledge/knowledge-articles"
                : "/knowledge/knowledge-articles/12",
            )
            expect(request.method).toBe(
              operation === "add" ? "POST" : operation === "edit" ? "PUT" : "DELETE",
            )
            return operation !== "withdraw"
              ? Response.json({ id: 12, revision: 18 })
              : new Response(null, { status: 204 })
          },
          { preconnect: fetch.preconnect },
        ),
      )
      try {
        expect((await post(operation, input)).status).toBe(200)
        expect(requests).toHaveLength(1)
        expect(requests[0]?.headers.get("idempotency-key")).toBe(key)
        expect(requests[0]?.headers.get("if-match")).toBe(operation === "add" ? null : '"17"')
        expect(await requests[0]?.json()).toEqual({
          reason: input.reason,
          ...(operation !== "withdraw"
            ? { title: input.title, category: input.category, body_md: input.body, tags: null }
            : {}),
        })
      } finally {
        interception.mockRestore()
      }
    })
    test(`${operation}: 確認条件が省略・不正ならAPIを呼ばない`, async () => {
      const interception = spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("unexpected network request"),
      )
      try {
        for (const invalid of [
          { ...input, reason: undefined },
          { ...input, reason: " " },
          { ...input, "idempotency-key": undefined },
          { ...input, "idempotency-key": "invalid" },
          ...(operation === "add"
            ? []
            : [
                { ...input, revision: undefined },
                { ...input, revision: "0" },
                { ...input, revision: "-1" },
                { ...input, revision: "1.1" },
                { ...input, revision: "9007199254740992" },
              ]),
        ])
          expect((await post(operation, invalid)).status).toBe(400)
        expect(interception).not.toHaveBeenCalled()
      } finally {
        interception.mockRestore()
      }
    })
  }
})

test("詳細の確認済み版と取下げ状態、履歴ページをCLIから取得できる", async () => {
  const paths: string[] = []
  const interception = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (target: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const request =
          target instanceof Request ? new Request(target, init) : new Request(String(target), init)
        const url = new URL(request.url)
        paths.push(url.pathname)
        expect(request.method).toBe("GET")
        if (url.pathname === "/knowledge/knowledge-articles/12")
          return Response.json({
            title: "Archived instructions",
            revision: 17,
            status: "withdrawn",
            category: "Operations",
            tags: null,
            body_md: "Retained text",
          })
        expect(url.pathname).toBe("/knowledge/knowledge-articles/12/revisions")
        expect(url.searchParams.get("limit")).toBe("5")
        expect(url.searchParams.get("offset")).toBe("10")
        return Response.json({ data: [{ revision: 7, reason: "Correct instructions" }], total: 17 })
      },
      { preconnect: fetch.preconnect },
    ),
  )
  try {
    const detail = await post("get/12", {})
    expect(detail.status).toBe(200)
    expect(await detail.text()).toContain("revision=17 status=withdrawn")
    const history = await post("history", { id: "12", limit: "5", offset: "10" })
    expect(history.status).toBe(200)
    expect(await history.json()).toEqual({
      data: [{ revision: 7, reason: "Correct instructions" }],
      total: 17,
    })
    expect(paths).toHaveLength(2)
  } finally {
    interception.mockRestore()
  }
})
