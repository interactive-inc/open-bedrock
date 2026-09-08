import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"
const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "personnel-employment-cli-"))
beforeAll(() => {
  process.env.BEDROCK_CONFIG_DIR = directory
})
afterAll(() => {
  if (originalConfig === undefined) delete process.env.BEDROCK_CONFIG_DIR
  else process.env.BEDROCK_CONFIG_DIR = originalConfig
  rmSync(directory, { recursive: true, force: true })
})
function request(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function capture() {
  const requests: Request[] = []
  const interception = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
        requests.push(
          input instanceof Request ? new Request(input, init) : new Request(String(input), init),
        )
        return Response.json({ id: "created" })
      },
      { preconnect: fetch.preconnect },
    ),
  )
  return { requests, interception }
}
describe("CLIの雇用区分", () => {
  test.each([undefined, "22345678-1234-4abc-8def-1234567890ab"])(
    "新規登録は指定した区分とUUID冪等キーを送信する: %s",
    async (key) => {
      const c = capture()
      const stdin = spyOn(Bun.stdin, "stream").mockReturnValue(
        new Blob(["example-initial-password\n"]).stream(),
      )
      try {
        const response = await request("/employees/register", {
          code: "E100",
          name: "Example Employee",
          email: "you@example.com",
          role: "member",
          "hire-on": "2026-10-01",
          "employment-type": "PART_TIME",
          "password-stdin": "true",
          "idempotency-key": key,
        })
        expect(response.status).toBe(200)
        expect(c.requests).toHaveLength(1)
        expect(c.requests[0]?.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/)
        if (key !== undefined) expect(c.requests[0]?.headers.get("Idempotency-Key")).toBe(key)
        expect(await c.requests[0]?.json()).toMatchObject({
          employment_type: "PART_TIME",
          hire_on: "2026-10-01",
        })
      } finally {
        stdin.mockRestore()
        c.interception.mockRestore()
      }
    },
  )
  test("新規登録の区分を省略しても標準入力やAPIを読み出さない", async () => {
    const c = capture()
    const stdin = spyOn(Bun.stdin, "stream")
    try {
      const response = await request("/employees/register", {
        code: "E100",
        name: "Example Employee",
        email: "you@example.com",
        role: "member",
        "hire-on": "2026-10-01",
        "password-stdin": "true",
      })
      expect(response.status).toBe(400)
      expect(stdin).not.toHaveBeenCalled()
      expect(c.requests).toHaveLength(0)
    } finally {
      stdin.mockRestore()
      c.interception.mockRestore()
    }
  })
  test.each(["apply", "request", "correct"])("発令payloadの区分を変更しない: %s", async (mode) => {
    const c = capture()
    const action = {
      kind: "rehire",
      employeeCode: "E100",
      employmentType: "PART_TIME",
      eventOn: "2026-10-01",
    }
    const payload = join(directory, `${mode}.json`)
    writeFileSync(
      payload,
      JSON.stringify(
        mode === "correct" ? { eventOn: "2026-09-01", replacementAction: action } : action,
      ),
    )
    try {
      const response = await request(`/personnel-actions/${mode}`, {
        type: "rehire",
        payload,
        "employee-revision": 3,
        "idempotency-key": crypto.randomUUID(),
        "action-id": crypto.randomUUID(),
        reason: "Correct confirmed contract",
      })
      expect(response.status).toBe(200)
      expect(c.requests).toHaveLength(1)
      const body = await c.requests[0]?.json()
      expect(body).toMatchObject({
        action: mode === "correct" ? { replacementAction: action } : action,
      })
    } finally {
      c.interception.mockRestore()
    }
  })
})

test("発令一覧は対象・期間・カーソルをGETへ渡す", async () => {
  const c = capture()
  try {
    const response = await request("/personnel-actions/list", {
      "employee-id": "employee:1",
      from: "2030-01-01",
      to: "2030-12-31",
      limit: "10",
      cursor: "opaque+/=",
    })
    expect(response.status).toBe(200)
    expect(c.requests).toHaveLength(1)
    const sent = c.requests[0]
    if (sent === undefined) throw new Error("request missing")
    expect(sent.method).toBe("GET")
    const url = new URL(sent.url)
    expect(url.pathname).toBe("/company/personnel-actions")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      employee_id: "employee:1",
      from: "2030-01-01",
      to: "2030-12-31",
      limit: "10",
      cursor: "opaque+/=",
    })
  } finally {
    c.interception.mockRestore()
  }
})
