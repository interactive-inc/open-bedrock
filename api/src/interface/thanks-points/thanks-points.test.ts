import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"
import { z } from "zod"

const jwtSecret = "thanks-points-test-secret"

// seed: E001 Alex Carter（id 1, admin）, E004 Drew Sato（id 4, member）, E005 Emery Lane（id 5, member）
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "admin" })
}

function senderToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "member",
  })
}

function recipientToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

function request(props: {
  db: D1Database
  path: string
  token: string | null
  method?: string
  body?: unknown
  now?: string
}): Promise<Response> {
  return requestWithContext({
    db: props.db,
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
    now: props.now,
  })
}

async function sendThanks(props: {
  db: D1Database
  token: string
  recipientCode: string
  points: number | null
  message?: string
  now?: string
}): Promise<Response> {
  return request({
    db: props.db,
    path: "/thanks",
    token: props.token,
    method: "POST",
    body: {
      recipient_employee_code: props.recipientCode,
      message: props.message ?? "ありがとう",
      points: props.points,
    },
    now: props.now,
  })
}

async function createReward(props: {
  db: D1Database
  pointCost: number
  stock?: number | null
}): Promise<number> {
  const response = await request({
    db: props.db,
    path: "/thanks/rewards",
    token: await adminToken(),
    method: "POST",
    body: { name: "景品", point_cost: props.pointCost, stock: props.stock ?? null },
  })

  const body = await response.json()

  const parsed = z.object({ id: z.number() }).parse(body)

  return parsed.id
}

describe("budget", () => {
  test("lazily creates the default monthly budget of 400pt", async () => {
    const db = await createTestDb()

    const response = await request({ db, path: "/thanks/budget/me", token: await senderToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ granted_points: z.number(), remaining_points: z.number() })
      .parse(await response.json())

    expect(parsed.granted_points).toBe(400)
    expect(parsed.remaining_points).toBe(400)
  })

  test("rejects sending more points than the remaining budget", async () => {
    const db = await createTestDb()

    const response = await sendThanks({
      db,
      token: await senderToken(),
      recipientCode: "E005",
      points: 401,
    })

    expect(response.status).toBe(400)
  })

  test("reflects sent points in the remaining budget", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const response = await request({ db, path: "/thanks/budget/me", token: await senderToken() })

    const parsed = z.object({ remaining_points: z.number() }).parse(await response.json())

    expect(parsed.remaining_points).toBe(300)
  })

  test("does not leak last month's spend into this month (monthly reset)", async () => {
    const db = await createTestDb()

    // 前月に原資いっぱい近くを贈与しても、当月の残量は満額のまま。
    await sendThanks({
      db,
      token: await senderToken(),
      recipientCode: "E005",
      points: 400,
      now: "2026-01-15T00:00:00.000Z",
    })

    const response = await request({
      db,
      path: "/thanks/budget/me",
      token: await senderToken(),
      now: "2026-02-01T00:00:00.000Z",
    })

    const parsed = z.object({ remaining_points: z.number() }).parse(await response.json())

    expect(parsed.remaining_points).toBe(400)
  })

  test("rejects negative points", async () => {
    const db = await createTestDb()

    const response = await sendThanks({
      db,
      token: await senderToken(),
      recipientCode: "E005",
      points: -10,
    })

    expect(response.status).toBe(400)
  })
})

describe("balance", () => {
  test("accumulates received points", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 120 })

    const response = await request({
      db,
      path: "/thanks/balance/me",
      token: await recipientToken(),
    })

    const parsed = z.object({ balance_points: z.number() }).parse(await response.json())

    expect(parsed.balance_points).toBe(120)
  })

  test("points-less thanks keeps balance at zero", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: null })

    const response = await request({
      db,
      path: "/thanks/balance/me",
      token: await recipientToken(),
    })

    const parsed = z.object({ balance_points: z.number() }).parse(await response.json())

    expect(parsed.balance_points).toBe(0)
  })
})

describe("rewards", () => {
  test("admin can create a reward and members can list it", async () => {
    const db = await createTestDb()

    const created = await request({
      db,
      path: "/thanks/rewards",
      token: await adminToken(),
      method: "POST",
      body: { name: "図書カード", point_cost: 50, stock: 10 },
    })

    expect(created.status).toBe(201)

    const list = await request({ db, path: "/thanks/rewards", token: await senderToken() })

    const parsed = z
      .array(z.object({ name: z.string(), point_cost: z.number() }))
      .parse(await list.json())

    expect(parsed.length).toBe(1)
    expect(parsed[0]?.point_cost).toBe(50)
  })

  test("non-admin cannot create a reward", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/rewards",
      token: await senderToken(),
      method: "POST",
      body: { name: "景品", point_cost: 50, stock: null },
    })

    expect(response.status).toBe(403)
  })

  test("rejects a non-positive point cost", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/rewards",
      token: await adminToken(),
      method: "POST",
      body: { name: "景品", point_cost: 0, stock: null },
    })

    expect(response.status).toBe(400)
  })
})

describe("redemption", () => {
  test("approves a redemption and deducts from balance", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requested = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(requested.status).toBe(201)

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const approved = await request({
      db,
      path: `/thanks/redemptions/${redemptionId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(approved.status).toBe(200)

    const balance = await request({ db, path: "/thanks/balance/me", token: await recipientToken() })

    const parsed = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsed.balance_points).toBe(40)
  })

  test("rejects a redemption request when balance is insufficient", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 30 })

    const rewardId = await createReward({ db, pointCost: 100 })

    const response = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(response.status).toBe(409)
  })

  test("prevents double approval (double spend) of the same redemption", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requested = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const first = await request({
      db,
      path: `/thanks/redemptions/${redemptionId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await request({
      db,
      path: `/thanks/redemptions/${redemptionId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(second.status).toBe(409)
  })

  test("prevents draining the balance below zero across two redemptions", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requestRedemption = async () => {
      const requested = await request({
        db,
        path: "/thanks/redemptions",
        token: await recipientToken(),
        method: "POST",
        body: { reward_id: rewardId },
      })

      return z.object({ id: z.number() }).parse(await requested.json()).id
    }

    const firstId = await requestRedemption()

    const secondId = await requestRedemption()

    const firstApprove = await request({
      db,
      path: `/thanks/redemptions/${firstId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(firstApprove.status).toBe(200)

    // 残高 100 から 60 を確定済み。2件目は残高 40 で 60 を要するため弾く。
    const secondApprove = await request({
      db,
      path: `/thanks/redemptions/${secondId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(secondApprove.status).toBe(409)
  })

  test("rejecting a redemption keeps the balance intact", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requested = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const rejected = await request({
      db,
      path: `/thanks/redemptions/${redemptionId}/reject`,
      token: await adminToken(),
      method: "POST",
    })

    expect(rejected.status).toBe(200)

    const balance = await request({ db, path: "/thanks/balance/me", token: await recipientToken() })

    const parsed = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsed.balance_points).toBe(100)
  })

  test("non-admin cannot approve a redemption", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requested = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const response = await request({
      db,
      path: `/thanks/redemptions/${redemptionId}/approve`,
      token: await senderToken(),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("rejects an invalid redemption id", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks/redemptions/0/approve",
      token: await adminToken(),
      method: "POST",
    })

    expect(response.status).toBe(400)
  })
})
