import { afterAll, beforeAll, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const originalConfig = process.env.BEDROCK_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "grade-assignment-cli-"))
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

test.each([200, 409])(
  "等級割当は確認条件を公開APIへ送り、成功・競合(%s)でも条件を変えて再試行しない",
  async (status) => {
    const body = {
      organizationId: "organization:example",
      expectedRevision: 17,
      reason: "Confirmed employment and grade",
      resources: [
        {
          organizationId: "organization:example",
          type: "grade-assignment",
          id: "grade-assignment:one",
          revision: 1,
          state: "active",
          effectiveFrom: "2030-01-01",
          effectiveTo: "2031-01-01",
          attributes: {
            employeeId: "employee:one",
            employmentId: "employment:rehired",
            gradeId: "grade:public",
          },
        },
      ],
    }
    const path = join(directory, "confirmed.json")
    await Bun.write(path, JSON.stringify(body))
    const f = capture({ organizationRevision: 18, replayed: false }, status)
    try {
      for (const attempt of [1, 2]) {
        expect(attempt).toBeGreaterThan(0)
        expect(
          (
            await request("/employee-grades/create", {
              data: path,
              "idempotency-key": "grade:confirmed",
            })
          ).status,
        ).toBe(status)
      }
      expect(f.requests).toHaveLength(2)
      for (const sent of f.requests) {
        expect(new URL(sent.url).pathname).toBe("/company/organization-changes")
        expect(sent.headers.get("if-match")).toBe("17")
        expect(sent.headers.get("idempotency-key")).toBe("grade:confirmed")
        expect(await sent.json()).toEqual({ reason: body.reason, resources: body.resources })
      }
      const missingEmployment = {
        ...body,
        resources: [
          {
            ...body.resources[0],
            attributes: { employeeId: "employee:one", gradeId: "grade:public" },
          },
        ],
      }
      await Bun.write(path, JSON.stringify(missingEmployment))
      expect(
        (
          await request("/employee-grades/create", {
            data: path,
            "idempotency-key": "grade:confirmed",
          })
        ).status,
      ).toBe(400)
      expect(
        (
          await request("/employee-grades/create", {
            "employee-id": "employee:one",
            "grade-id": "1",
            "effective-date": "2030-01-01",
          })
        ).status,
      ).toBe(400)
      expect(f.requests).toHaveLength(2)
    } finally {
      f.interception.mockRestore()
    }
  },
)

test("等級一覧は公開履歴の会社版を保ち、別従業員や別種類の資源を混ぜない", async () => {
  const grade = {
    type: "grade-assignment",
    id: "assignment:one",
    revision: 2,
    attributes: {
      employeeId: "employee:one",
      employmentId: "employment:rehired",
      gradeId: "grade:public",
    },
  }
  const f = capture({
    organizationId: "organization:example",
    organizationRevision: 19,
    resources: [
      grade,
      {
        ...grade,
        id: "assignment:other",
        attributes: { ...grade.attributes, employeeId: "employee:other" },
      },
      { ...grade, type: "assignment" },
    ],
  })
  try {
    const response = await request("/employee-grades/list", {
      "organization-id": "organization:example",
      "employee-id": "employee:one",
      "as-of": "2030-01-01",
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      organizationId: "organization:example",
      organizationRevision: 19,
      resources: [grade],
    })
    expect(f.requests).toHaveLength(1)
    expect(new URL(f.requests[0]!.url).pathname).toBe("/company/organization-snapshots")
    expect(new URL(f.requests[0]!.url).searchParams.get("effective_on")).toBe("2030-01-01")
    expect((await request("/employee-grades/list", { "employee-code": "OLD" })).status).toBe(400)
    expect(f.requests).toHaveLength(1)
  } finally {
    f.interception.mockRestore()
  }
})
