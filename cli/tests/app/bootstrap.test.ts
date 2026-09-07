import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "company-bootstrap-cli-"))
beforeAll(() => {
  process.env.BEDROCK_CONFIG_DIR = directory
})
afterAll(() => {
  if (originalConfig === undefined) delete process.env.BEDROCK_CONFIG_DIR
  else process.env.BEDROCK_CONFIG_DIR = originalConfig
  rmSync(directory, { recursive: true, force: true })
})
const key = "12345678-1234-4abc-8def-1234567890ab"
const declaration = {
  name: "First Member",
  code: "FIRST-001",
  organization_name: "Example Company",
  representative_name: "Confirmed Representative",
  initial_responsibilities: [],
  hire_date: "2026-01-01",
  employment_type: "PART_TIME",
  locale: "ja-JP",
  time_zone: "Asia/Tokyo",
  fiscal_year_start_month: 4,
  reason: "Confirmed initial facts",
}
const filename = join(directory, "company.json")
writeFileSync(filename, JSON.stringify(declaration))
const input = {
  email: "root@example.com",
  password: "bootstrap-test-password",
  "company-data": filename,
  "idempotency-key": key,
  token: "bootstrap-test-token",
  "base-url": "https://company.example.test",
}
function post(body: unknown) {
  return app.request("/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function settings() {
  const file = join(directory, "settings.json")
  return existsSync(file) ? readFileSync(file, "utf8") : null
}
function capture() {
  const requests: Request[] = []
  const replies = { systemStatus: 201, companyStatus: 201 }
  const interception = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (target: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const request =
          target instanceof Request ? new Request(target, init) : new Request(String(target), init)
        requests.push(request)
        const path = new URL(request.url).pathname
        if (path === "/system/bootstrap")
          return Response.json(
            { account_id: "account:first", code: "already_initialized" },
            { status: replies.systemStatus },
          )
        if (path === "/system/sessions")
          return Response.json(
            {
              account_id: "account:first",
              access_token: "new-session-token",
              refresh_token: "refresh-token",
            },
            { status: 201 },
          )
        if (path === "/company/bootstrap") {
          if (replies.companyStatus >= 400)
            return Response.json(
              { code: "company_bootstrap_conflict", detail: "Company initialization failed" },
              { status: replies.companyStatus },
            )
          return Response.json(
            {
              account_id: "account:first",
              employee_id: "employee:opaque-first",
              organization_revision: 3,
              replayed: replies.companyStatus === 200,
            },
            { status: replies.companyStatus },
          )
        }
        throw new Error(`unexpected request path: ${path}`)
      },
      { preconnect: fetch.preconnect },
    ),
  )
  return { requests, replies, interception }
}

describe("bootstrap command", () => {
  test("確認済み会社JSONと再送キーを案内する", async () => {
    const response = await post({ help: "1" })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("--company-data")
  })

  test("opaque従業員IDを受け取り、明示した初期事実とキーを送り、ログインを保存する", async () => {
    const f = capture()
    try {
      const response = await post(input)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain("employee_id=employee:opaque-first")
      expect(f.requests.map((request) => new URL(request.url).pathname)).toEqual([
        "/system/bootstrap",
        "/system/sessions",
        "/company/bootstrap",
      ])
      const company = f.requests[2]
      if (company === undefined) throw new Error("company request missing")
      expect(await company.json()).toEqual(declaration)
      expect(company.headers.get("idempotency-key")).toBe(key)
      expect(company.headers.get("authorization")).toBe("Bearer new-session-token")
      expect(settings()).toContain("new-session-token")
    } finally {
      f.interception.mockRestore()
    }
  })

  test("Company保存失敗後は同じJSONとキーで復旧し、保存済みの再送結果も受け取れる", async () => {
    const f = capture()
    const before = settings()
    try {
      f.replies.companyStatus = 503
      expect((await post(input)).status).toBe(503)
      expect(settings()).toBe(before)
      f.replies.systemStatus = 409
      f.replies.companyStatus = 201
      expect((await post(input)).status).toBe(200)
      f.replies.companyStatus = 200
      const replay = await post(input)
      expect(replay.status).toBe(200)
      expect(await replay.text()).toContain("保存済みの初期化")
      const companyRequests = f.requests.filter(
        (request) => new URL(request.url).pathname === "/company/bootstrap",
      )
      expect(companyRequests).toHaveLength(3)
      for (const request of companyRequests) {
        expect(request.headers.get("idempotency-key")).toBe(key)
        expect(await request.json()).toEqual(declaration)
      }
    } finally {
      f.interception.mockRestore()
    }
  })

  test("Companyの409を成功扱いせずログイン設定を変更しない", async () => {
    const f = capture()
    const before = settings()
    try {
      f.replies.systemStatus = 409
      f.replies.companyStatus = 409
      expect((await post(input)).status).toBe(409)
      expect(settings()).toBe(before)
    } finally {
      f.interception.mockRestore()
    }
  })

  test("確認キーと雇用区分の不足をSystem初期化より前に拒否する", async () => {
    const f = capture()
    const missing = join(directory, "incomplete.json")
    writeFileSync(missing, JSON.stringify({ ...declaration, employment_type: undefined }))
    try {
      expect((await post({ ...input, "idempotency-key": undefined })).status).toBe(400)
      expect((await post({ ...input, "company-data": missing })).status).toBe(400)
      expect(f.requests).toHaveLength(0)
    } finally {
      f.interception.mockRestore()
    }
  })
})
