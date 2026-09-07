import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"
const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "organization-adoption-cli-"))
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
const key = "12345678-1234-4abc-8def-1234567890ab"
const body = {
  organizationUnitId: "unit:adoption",
  expectedRevision: 4,
  snapshotDigest: "a".repeat(64),
  observedOn: "2026-09-07",
  reason: "Confirmed history",
}

describe("CLI organization adoption", () => {
  test("履歴の参照を指定された組織IDで行う", async () => {
    const captured = capture()
    try {
      expect(
        (
          await request("/departments/adoption", {
            "organization-unit-id": body.organizationUnitId,
          })
        ).status,
      ).toBe(200)
      expect(captured.requests).toHaveLength(1)
      expect(captured.requests[0]?.method).toBe("GET")
      expect(
        new URL(captured.requests[0]?.url ?? "http://localhost").searchParams.get(
          "organization_unit_id",
        ),
      ).toBe(body.organizationUnitId)
    } finally {
      captured.interception.mockRestore()
    }
  })
  test("確認済みJSONとキーをそのまま送り、競合を自動再送しない", async () => {
    const path = join(directory, "confirmed.json")
    await Bun.write(path, JSON.stringify(body))
    const captured = capture(409)
    try {
      expect(
        (await request("/departments/adoption", { data: path, "idempotency-key": key })).status,
      ).toBe(409)
      expect(captured.requests).toHaveLength(1)
      expect(captured.requests[0]?.method).toBe("POST")
      expect(captured.requests[0]?.headers.get("idempotency-key")).toBe(key)
      expect(await captured.requests[0]?.json()).toEqual(body)
    } finally {
      captured.interception.mockRestore()
    }
  })
  test("確認参照のないJSONや冪等キーのない保存ではAPIを呼ばない", async () => {
    const path = join(directory, "missing.json")
    await Bun.write(path, JSON.stringify({ ...body, snapshotDigest: undefined }))
    const captured = capture()
    try {
      expect(
        (await request("/departments/adoption", { data: path, "idempotency-key": key })).status,
      ).toBe(400)
      expect((await request("/departments/adoption", { data: path })).status).toBe(400)
      expect(captured.requests).toHaveLength(0)
    } finally {
      captured.interception.mockRestore()
    }
  })
  test("helpから参照と保存の指定を確認できる", async () => {
    const response = await request("/departments/adoption", { help: "1" })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("--data <confirmed-history.json>")
  })
})
