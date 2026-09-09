import { afterAll, beforeAll, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "employee-adoption-batch-cli-"))
beforeAll(() => {
  process.env.BEDROCK_CONFIG_DIR = directory
})
afterAll(() => {
  if (originalConfig === undefined) delete process.env.BEDROCK_CONFIG_DIR
  else process.env.BEDROCK_CONFIG_DIR = originalConfig
  rmSync(directory, { recursive: true, force: true })
})

test("一括確認した一覧とキーをそのまま送り、競合を自動再送しない", async () => {
  const path = join(directory, "confirmed.json")
  const key = "12345678-1234-4abc-8def-1234567890ab"
  const confirmed = {
    expectedRevision: 4,
    observedOn: "2026-09-07",
    reason: "Confirmed history",
    employees: [
      {
        employeeId: "employee:example",
        snapshotDigest: "a".repeat(64),
        corrections: [
          {
            organizationId: "organization:default",
            type: "person",
            id: "person:example",
            revision: 2,
            state: "active",
            effectiveFrom: "2020-01-01",
            effectiveTo: null,
            attributes: { officialName: "Example Person" },
          },
        ],
      },
    ],
  }
  await Bun.write(path, JSON.stringify(confirmed))
  const requests: Request[] = []
  const intercepted = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
        requests.push(
          input instanceof Request ? new Request(input, init) : new Request(String(input), init),
        )
        return Response.json({ code: "employee_resource_adoption_conflict" }, { status: 409 })
      },
      { preconnect: fetch.preconnect },
    ),
  )
  try {
    const response = await app.request("/employees/adoption-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: path, "idempotency-key": key }),
    })
    expect(response.status).toBe(409)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe("POST")
    expect(new URL(requests[0]!.url).pathname).toBe("/company/employee-resource-adoption-batches")
    expect(requests[0]?.headers.get("idempotency-key")).toBe(key)
    expect(await requests[0]?.json()).toEqual(confirmed)
    await Bun.write(
      path,
      JSON.stringify({ ...confirmed, employees: [confirmed.employees[0], confirmed.employees[0]] }),
    )
    const invalid = await app.request("/employees/adoption-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: path, "idempotency-key": key }),
    })
    expect(invalid.status).toBe(400)
    expect(requests).toHaveLength(1)
  } finally {
    intercepted.mockRestore()
  }
})
