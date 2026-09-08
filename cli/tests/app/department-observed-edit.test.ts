import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "department-observed-cli-"))
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
  code: "CONFIRMED",
  name: "Confirmed name",
  "organization-revision": "17",
  "as-of": "2026-09-09",
  "idempotency-key": key,
}
function post(operation: string, body: unknown) {
  return app.request(`/departments/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("department CLI preserves the observed edit condition", () => {
  for (const operation of ["update", "delete"]) {
    test(`${operation}: 指定した版・日付・再送キーをそのままAPIへ送り、最新版を取り直さない`, async () => {
      const requests: Request[] = []
      const interception = spyOn(globalThis, "fetch").mockImplementation(
        Object.assign(
          async (target: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
            const request =
              target instanceof Request
                ? new Request(target, init)
                : new Request(String(target), init)
            requests.push(request)
            expect(new URL(request.url).pathname).toBe("/company/organization-units/CONFIRMED")
            expect(request.method).toBe(operation === "update" ? "PUT" : "DELETE")
            return operation === "update"
              ? Response.json({ code: "CONFIRMED" })
              : new Response(null, { status: 204 })
          },
          { preconnect: fetch.preconnect },
        ),
      )
      try {
        expect((await post(operation, input)).status).toBe(200)
        expect(requests).toHaveLength(1)
        expect(requests[0]?.headers.get("idempotency-key")).toBe(key)
        expect(await requests[0]?.json()).toEqual({
          expected_organization_revision: 17,
          expected_as_of: "2026-09-09",
          ...(operation === "update" ? { name: "Confirmed name", parent_code: null } : {}),
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
          { ...input, "organization-revision": undefined },
          { ...input, "as-of": undefined },
          { ...input, "idempotency-key": undefined },
          { ...input, "organization-revision": "" },
          { ...input, "organization-revision": "-1" },
          { ...input, "organization-revision": "1.1" },
          { ...input, "organization-revision": "9007199254740992" },
          { ...input, "as-of": "2026-02-30" },
        ])
          expect((await post(operation, invalid)).status).toBe(400)
        expect(interception).not.toHaveBeenCalled()
      } finally {
        interception.mockRestore()
      }
    })
  }
})
