import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"
const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "employee-profile-cli-"))
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
function capture(status = 200) {
  const requests: Request[] = []
  const interception = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
        requests.push(
          input instanceof Request ? new Request(input, init) : new Request(String(input), init),
        )
        return Response.json(
          { code: status === 409 ? "employee_profile_conflict" : "PROFILE-001" },
          { status },
        )
      },
      { preconnect: fetch.preconnect },
    ),
  )
  return { requests, interception }
}
const input = {
  name: "Changed Person",
  "employee-id": "employee:profile",
  "company-revision": 7,
  "person-revision": 3,
  "effective-on": "2026-06-02",
  reason: "Confirm corrected name",
  "idempotency-key": "12345678-1234-4abc-8def-1234567890ab",
}
describe("CLIの人物情報更新", () => {
  test("明示した人物版と会社版を同じ冪等キーで送り、送信時に最新版へ差し替えない", async () => {
    const captureResult = capture()
    try {
      expect((await request("/employees/update/PROFILE-001", input)).status).toBe(200)
      expect(captureResult.requests).toHaveLength(1)
      expect(captureResult.requests[0]?.method).toBe("PUT")
      expect(captureResult.requests[0]?.headers.get("idempotency-key")).toBe(
        input["idempotency-key"],
      )
      expect(await captureResult.requests[0]?.json()).toEqual({
        name: input.name,
        reason: input.reason,
        profile: {
          employeeId: input["employee-id"],
          organizationRevision: 7,
          personRevision: 3,
          effectiveOn: "2026-06-02",
        },
      })
    } finally {
      captureResult.interception.mockRestore()
    }
  })
  test.each([
    "employee-id",
    "company-revision",
    "person-revision",
    "effective-on",
    "idempotency-key",
    "reason",
  ])("%sを省略するとAPIを呼ばない", async (field) => {
    const captureResult = capture()
    try {
      expect(
        (await request("/employees/update/PROFILE-001", { ...input, [field]: undefined })).status,
      ).toBe(400)
      expect(captureResult.requests).toHaveLength(0)
    } finally {
      captureResult.interception.mockRestore()
    }
  })
  test("競合を一度だけ返して自動再送しない", async () => {
    const captureResult = capture(409)
    try {
      const response = await request("/employees/update/PROFILE-001", input)
      expect(response.status).toBe(409)
      expect(captureResult.requests).toHaveLength(1)
    } finally {
      captureResult.interception.mockRestore()
    }
  })
})
