import { afterAll, beforeAll, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "definition-history-cli-"))
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

function capture(body: unknown, status = 200) {
  const requests: Request[] = []
  const interception = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
        requests.push(
          input instanceof Request ? new Request(input, init) : new Request(String(input), init),
        )
        return Response.json(body, { status })
      },
      { preconnect: fetch.preconnect },
    ),
  )
  return { requests, interception }
}

function command(type: "grade" | "position", action: "create" | "update" | "delete") {
  return {
    organizationId: "organization:example",
    expectedRevision: 17,
    reason: "Confirmed definition",
    resources: [
      {
        organizationId: "organization:example",
        type,
        id: `${type}:public`,
        revision: action === "create" ? 1 : 2,
        state: action === "delete" ? "void" : "active",
        effectiveFrom: "2030-06-01",
        effectiveTo: "2031-01-01",
        attributes: {
          code: "SENIOR",
          officialName: "Senior",
          rank: 3,
          description: null,
          ...(type === "position" ? { jobId: null } : {}),
        },
      },
    ],
  }
}

test.each(["grade", "position"] as const)(
  "%s一覧は公開定義の時点と会社版を保持する",
  async (type) => {
    const resources = [
      command("grade", "create").resources[0],
      command("position", "create").resources[0],
    ]
    const snapshot = { organizationId: "organization:example", organizationRevision: 17, resources }
    const f = capture(snapshot)
    try {
      const response = await request(`/${type}-definitions/list`, {
        "organization-id": "organization:example",
        "as-of": "2030-06-01",
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        ...snapshot,
        resources: resources.filter((resource) => resource?.type === type),
      })
      expect(f.requests).toHaveLength(1)
      const sent = f.requests[0]!
      expect(sent.method).toBe("GET")
      expect(new URL(sent.url).pathname).toBe("/company/definitions")
      expect(new URL(sent.url).searchParams.get("effective_on")).toBe("2030-06-01")
      expect(sent.headers.get("x-company-organization-id")).toBe("organization:example")
    } finally {
      f.interception.mockRestore()
    }
  },
)

for (const type of ["grade", "position"] as const) {
  for (const action of ["create", "update", "delete"] as const) {
    test(`${type} ${action}は確認した資源と版だけを公開APIへ送り、競合を自動解消しない`, async () => {
      const body = command(type, action)
      const path = join(directory, `${type}-${action}.json`)
      await Bun.write(path, JSON.stringify(body))
      const f = capture({ code: "company_revision_conflict" }, 409)
      try {
        const response = await request(`/${type}-definitions/${action}`, {
          data: path,
          "idempotency-key": "same:command",
        })
        expect(response.status).toBe(409)
        expect(f.requests).toHaveLength(1)
        const sent = f.requests[0]!
        expect(new URL(sent.url).pathname).toBe("/company/definitions")
        expect(sent.method).toBe("POST")
        expect(sent.headers.get("if-match")).toBe("17")
        expect(sent.headers.get("idempotency-key")).toBe("same:command")
        expect(sent.headers.get("x-company-organization-id")).toBe(body.organizationId)
        expect(await sent.json()).toEqual({ reason: body.reason, resources: body.resources })
      } finally {
        f.interception.mockRestore()
      }
    })
  }
}

test("確認版・キーのない旧入力や別種・別会社・取消状態の不一致ではAPIを呼ばない", async () => {
  const body = command("grade", "update")
  const resource = body.resources[0]!
  const f = capture({})
  try {
    for (const invalid of [
      { ...body, expectedRevision: undefined },
      { ...body, resources: [{ ...resource, organizationId: "other:company" }] },
      {
        ...body,
        resources: [
          { ...resource, type: "position", attributes: { ...resource.attributes, jobId: null } },
        ],
      },
      { ...body, resources: [{ ...resource, state: "void" }] },
      { ...body, resources: [{ ...resource, revision: 1 }] },
    ]) {
      const path = join(directory, "invalid.json")
      await Bun.write(path, JSON.stringify(invalid))
      expect(
        (
          await request("/grade-definitions/update", {
            data: path,
            "idempotency-key": "same:command",
          })
        ).status,
      ).toBe(400)
    }
    const path = join(directory, "valid.json")
    await Bun.write(path, JSON.stringify(body))
    expect((await request("/grade-definitions/update", { data: path })).status).toBe(400)
    expect(
      (await request("/grade-definitions/update", { id: "1", code: "OLD", name: "Old", rank: "1" }))
        .status,
    ).toBe(400)
    expect((await request("/grade-definitions/list", {})).status).toBe(400)
    expect(f.requests).toHaveLength(0)
  } finally {
    f.interception.mockRestore()
  }
})
