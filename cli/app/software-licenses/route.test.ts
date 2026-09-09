import { afterEach, beforeEach, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"
import { toRequest } from "@/lib/router/router"

let directory: string
let previousConfig: string | undefined
let requests: Request[]
let responses: Response[]
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>
const assignmentId = "00000000-0000-4000-8000-000000000001"

beforeEach(() => {
  previousConfig = process.env.BEDROCK_CONFIG_DIR
  directory = mkdtempSync(join(tmpdir(), "license-cli-"))
  process.env.BEDROCK_CONFIG_DIR = directory
  requests = []
  responses = []
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        requests.push(
          input instanceof Request ? new Request(input, init) : new Request(String(input), init),
        )
        const response = responses.shift()
        if (response === undefined) throw new Error("Unexpected API request")
        return response
      },
      { preconnect: fetch.preconnect },
    ),
  )
})

afterEach(() => {
  fetchSpy.mockRestore()
  if (previousConfig === undefined) delete process.env.BEDROCK_CONFIG_DIR
  else process.env.BEDROCK_CONFIG_DIR = previousConfig
  rmSync(directory, { recursive: true, force: true })
  expect(responses).toHaveLength(0)
})

function run(...args: string[]) {
  const parsed = toRequest(["software-licenses", ...args])
  return app.request(parsed.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.body),
  })
}

test("契約・プラン登録の再送は同じキーと本文を保持する", async () => {
  responses.push(Response.json({ id: 8, revision: 0 }), Response.json({ id: 8, revision: 0 }))
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await run(
      "create",
      "--name",
      "Example Service",
      "--plan-name",
      "Team",
      "--seats",
      "10",
      "--idempotency-key",
      "license:confirmed",
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 8, revision: 0 })
  }
  expect(requests).toHaveLength(2)
  for (const request of requests) {
    expect(request.method).toBe("POST")
    expect(new URL(request.url).pathname).toBe("/software-license/software-licenses")
    expect(request.headers.get("idempotency-key")).toBe("license:confirmed")
    expect(await request.json()).toEqual({ name: "Example Service", plan_name: "Team", seats: 10 })
  }
})

test("確認済み版をそのまま送り、競合時に再読取や上書きをしない", async () => {
  responses.push(
    Response.json({ code: "license_conflict" }, { status: 409 }),
    Response.json({ id: 8, revision: 4 }),
  )
  expect(
    (
      await run(
        "update",
        "8",
        "--name",
        "Example",
        "--plan-name",
        "Business",
        "--expected-revision",
        "3",
      )
    ).status,
  ).toBe(409)
  expect((await run("cancel", "8", "--expected-revision", "3")).status).toBe(200)
  expect(requests).toHaveLength(2)
  expect(requests[0]?.method).toBe("PUT")
  expect(requests[0]?.headers.get("if-match")).toBe("3")
  expect(await requests[0]?.json()).toEqual({ name: "Example", plan_name: "Business" })
  expect(new URL(requests[1]!.url).pathname).toBe("/software-license/software-licenses/8/cancel")
  expect(requests[1]?.method).toBe("POST")
  expect(requests[1]?.headers.get("if-match")).toBe("3")
})

test("プラン名の省略と明示的な解除を区別する", async () => {
  responses.push(Response.json({ ok: true }), Response.json({ ok: true }))
  expect((await run("update", "8", "--name", "Example", "--expected-revision", "0")).status).toBe(
    200,
  )
  expect(await requests[0]?.json()).toEqual({ name: "Example" })
  expect(
    (await run("update", "8", "--name", "Example", "--expected-revision", "1", "--clear-plan"))
      .status,
  ).toBe(200)
  expect(await requests[1]?.json()).toEqual({ name: "Example", plan_name: null })
})

test("契約一覧・利用者一覧・履歴の絞り込みと続きを保持する", async () => {
  const page = { data: [{ employee_name: "Person", plan_name: "Team" }], has_more: true }
  responses.push(
    Response.json({ data: [], total: 120 }),
    Response.json(page),
    Response.json({ data: [], has_more: true }),
    Response.json({ id: 8, revision: 12 }, { headers: { ETag: '"12"' } }),
  )
  expect(
    (await run("list", "--status", "active", "--limit", "100", "--offset", "100")).status,
  ).toBe(200)
  expect(
    await (
      await run(
        "assignments",
        "--license-id",
        "8",
        "--employee-id",
        "employee:one",
        "--state",
        "released",
        "--limit",
        "5",
        "--offset",
        "10",
      )
    ).json(),
  ).toEqual(page)
  expect((await run("history", "8", "--offset", "50")).status).toBe(200)
  expect(await (await run("get", "8")).json()).toEqual({ id: 8, revision: 12 })
  expect(requests.every((request) => request.method === "GET")).toBe(true)
  expect(Object.fromEntries(new URL(requests[0]!.url).searchParams)).toEqual({
    status: "active",
    limit: "100",
    offset: "100",
  })
  expect(new URL(requests[1]!.url).pathname).toBe("/software-license/software-licenses/assignments")
  expect(Object.fromEntries(new URL(requests[1]!.url).searchParams)).toEqual({
    license_id: "8",
    employee_id: "employee:one",
    state: "released",
    limit: "5",
    offset: "10",
  })
  expect(new URL(requests[2]!.url).pathname).toBe("/software-license/software-licenses/8/history")
  expect(new URL(requests[2]!.url).searchParams.get("offset")).toBe("50")
  expect(new URL(requests[3]!.url).pathname).toBe("/software-license/software-licenses/8")
})

test("割当と解除は確認済みID・理由・アカウント参照を変更しない", async () => {
  responses.push(
    Response.json({ id: assignmentId }, { status: 201 }),
    Response.json({ id: assignmentId }),
    Response.json({ id: assignmentId, released_at: 1 }),
  )
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(
      (
        await run(
          "assign",
          "8",
          "--assignment-id",
          assignmentId,
          "--employee-id",
          "employee:one",
          "--reason",
          "Confirmed assignment",
          "--account-reference",
          "member@example.com",
        )
      ).status,
    ).toBe(200)
  }
  expect((await run("release", assignmentId, "--reason", "Access ended")).status).toBe(200)
  for (const request of requests.slice(0, 2)) {
    expect(request.method).toBe("POST")
    expect(new URL(request.url).pathname).toBe("/software-license/software-licenses/8/assignments")
    expect(await request.json()).toEqual({
      id: assignmentId,
      employee_id: "employee:one",
      account_reference: "member@example.com",
      reason: "Confirmed assignment",
    })
  }
  expect(new URL(requests[2]!.url).pathname).toBe(
    `/software-license/software-licenses/assignments/${assignmentId}/release`,
  )
  expect(await requests[2]?.json()).toEqual({ reason: "Access ended" })
})

test("資格不足や機能無効は成功扱いせず、再試行もしない", async () => {
  responses.push(
    Response.json({ code: "license_forbidden" }, { status: 403 }),
    Response.json({ code: "not_found" }, { status: 404 }),
  )
  expect((await run("release", assignmentId, "--reason", "End")).status).toBe(403)
  expect((await run("assignments")).status).toBe(404)
  expect(requests).toHaveLength(2)
})

test("キー・確認版・割当ID・理由の欠落や不正入力ではAPIを呼ばない", async () => {
  const cases = [
    ["create", "--name", "Example"],
    ["create", "--name", "Example", "--idempotency-key", "bad\r\nheader"],
    ["create", "--name", "Example", "--idempotency-key", "key", "--seats", "1.5"],
    ["update", "8", "--name", "Example"],
    [
      "update",
      "8",
      "--name",
      "Example",
      "--expected-revision",
      "1",
      "--plan-name",
      "Team",
      "--clear-plan",
    ],
    ["cancel", "8"],
    ["cancel", "8", "--expected-revision", "1.5"],
    ["cancel", "8", "--expected-revision", "9007199254740992"],
    ["get"],
    ["get", "9007199254740992"],
    ["history", "0"],
    ["assign", "8", "--employee-id", "employee:one", "--reason", "Confirmed"],
    ["assign", "8", "--assignment-id", assignmentId, "--reason", "Confirmed"],
    ["assign", "8", "--assignment-id", assignmentId, "--employee-id", "employee:one"],
    ["release", assignmentId],
    ["release", "not-a-uuid", "--reason", "End"],
    ["assignments", "--limit", "101"],
    ["assignments", "--offset", "100001"],
    ["assignments", "--state", "active"],
    ["assignments", "--employee-id", "has space"],
  ]
  for (const args of cases) expect((await run(...args)).status, args.join(" ")).toBe(400)
  expect(requests).toHaveLength(0)
})

test("全コマンドのhelpは認証や通信なしで読める", async () => {
  for (const command of [
    "list",
    "get",
    "history",
    "create",
    "update",
    "cancel",
    "assignments",
    "assign",
    "release",
  ]) {
    const response = await run(command, "--help")
    expect(response.status).toBe(200)
    expect(await response.text()).toContain(`bedrock software-licenses ${command}`)
  }
  expect(await (await run()).text()).toContain("--expected-revision")
  expect(requests).toHaveLength(0)
})
