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

function otherRecipientToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 10,
    email: "you+e010@example.com",
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

  test("rejects a second redemption request while a pending one exists", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const first = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(first.status).toBe(201)

    // pending が既に存在するため 2 件目は 409 で弾かれる。
    const second = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(second.status).toBe(409)
  })

  test("allows a new redemption after the previous pending is resolved", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 200 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const first = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(first.status).toBe(201)

    const firstId = z.object({ id: z.number() }).parse(await first.json()).id

    // 1 件目を承認して pending を解消する。
    const approved = await request({
      db,
      path: `/thanks/redemptions/${firstId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(approved.status).toBe(200)

    // pending が無くなったので 2 件目を申請できる。
    const second = await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(second.status).toBe(201)
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

  test("forbids the applicant from approving their own redemption", async () => {
    const db = await createTestDb()

    // admin(E001) にポイントを付与する。
    await sendThanks({ db, token: await senderToken(), recipientCode: "E001", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    // admin 自身が交換申請を出す。
    const requested = await request({
      db,
      path: "/thanks/redemptions",
      token: await adminToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(requested.status).toBe(201)

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    // admin 本人が承認しようとすると 403 で弾かれる。
    const response = await request({
      db,
      path: `/thanks/redemptions/${redemptionId}/approve`,
      token: await adminToken(),
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

describe("redemption pagination", () => {
  const redemptionListSchema = z.array(
    z.object({ id: z.number(), employee_id: z.number(), status: z.string() }),
  )

  // 同時 pending は 1 件までなので、申請→却下で解決済みの交換を 1 件積み増す。
  async function createRejectedRedemption(props: {
    db: D1Database
    recipientTokenValue: string
    rewardId: number
  }): Promise<void> {
    const requested = await request({
      db: props.db,
      path: "/thanks/redemptions",
      token: props.recipientTokenValue,
      method: "POST",
      body: { reward_id: props.rewardId },
    })

    const id = z.object({ id: z.number() }).parse(await requested.json()).id

    await request({
      db: props.db,
      path: `/thanks/redemptions/${id}/reject`,
      token: await adminToken(),
      method: "POST",
    })
  }

  test("limits and offsets my redemptions", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 200 })

    const rewardId = await createReward({ db, pointCost: 10 })

    const recipientTokenValue = await recipientToken()

    await createRejectedRedemption({ db, recipientTokenValue, rewardId })
    await createRejectedRedemption({ db, recipientTokenValue, rewardId })
    await createRejectedRedemption({ db, recipientTokenValue, rewardId })

    const page1 = await request({
      db,
      path: "/thanks/redemptions/me?limit=2",
      token: recipientTokenValue,
    })

    expect(page1.status).toBe(200)

    const list1 = redemptionListSchema.parse(await page1.json())

    expect(list1.length).toBe(2)

    const page2 = await request({
      db,
      path: "/thanks/redemptions/me?limit=2&offset=2",
      token: recipientTokenValue,
    })

    expect(page2.status).toBe(200)

    const list2 = redemptionListSchema.parse(await page2.json())

    expect(list2.length).toBe(1)

    // ページ間で id が重複しない（新しい順）。
    expect(list1.map((row) => row.id)).not.toContain(list2[0]?.id)
  })

  test("limits and offsets the pending inbox", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })
    await sendThanks({ db, token: await senderToken(), recipientCode: "E010", points: 100 })

    const rewardId = await createReward({ db, pointCost: 10 })

    // 異なる社員がそれぞれ pending を 1 件ずつ持つ（合計 2 件）。
    await request({
      db,
      path: "/thanks/redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    await request({
      db,
      path: "/thanks/redemptions",
      token: await otherRecipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const page1 = await request({
      db,
      path: "/thanks/redemptions/inbox?limit=1",
      token: await adminToken(),
    })

    expect(page1.status).toBe(200)

    const list1 = redemptionListSchema.parse(await page1.json())

    expect(list1.length).toBe(1)

    const page2 = await request({
      db,
      path: "/thanks/redemptions/inbox?limit=1&offset=1",
      token: await adminToken(),
    })

    expect(page2.status).toBe(200)

    const list2 = redemptionListSchema.parse(await page2.json())

    expect(list2.length).toBe(1)
    expect(list1[0]?.id).not.toBe(list2[0]?.id)
  })
})

describe("atomicity", () => {
  // 同一社員の同時申請。pending が 1 件しか作られないことを確認する。
  test("concurrent redemption requests from the same employee: exactly one succeeds", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60, stock: null })

    const recipientTokenValue = await recipientToken()

    const requestOnce = () =>
      request({
        db,
        path: "/thanks/redemptions",
        token: recipientTokenValue,
        method: "POST",
        body: { reward_id: rewardId },
      })

    const responses = await Promise.all([requestOnce(), requestOnce()])

    const statuses = responses
      .map((response) => response.status)
      .sort((left, right) => left - right)

    expect(statuses).toEqual([201, 409])
  })

  // 原資400で各300の感謝2件を同時送付。合計600>400なので片方は原資不足で弾かれ、残量は負にならない。
  test("two point-thanks from the same budget: one succeeds, budget never goes negative", async () => {
    const db = await createTestDb()

    const senderTokenValue = await senderToken()

    const sendOnce = () =>
      request({
        db,
        path: "/thanks",
        token: senderTokenValue,
        method: "POST",
        body: { recipient_employee_code: "E005", message: "ありがとう", points: 300 },
      })

    const responses = await Promise.all([sendOnce(), sendOnce()])

    const statuses = responses
      .map((response) => response.status)
      .sort((left, right) => left - right)

    expect(statuses).toEqual([201, 400])

    const budget = await request({ db, path: "/thanks/budget/me", token: senderTokenValue })

    const parsed = z
      .object({ remaining_points: z.number(), consumed_points: z.number() })
      .parse(await budget.json())

    expect(parsed.consumed_points).toBe(300)
    expect(parsed.remaining_points).toBe(100)
    expect(parsed.remaining_points).toBeGreaterThanOrEqual(0)
  })

  // 在庫1の景品に対し、各々残高十分な2人が同時に交換確定。在庫はマイナスにならず1件だけ在庫を消費する。
  test("stock never goes negative under concurrent approvals", async () => {
    const db = await createTestDb()

    // E005 と E010 にそれぞれ十分な残高を配る。
    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })
    await sendThanks({ db, token: await senderToken(), recipientCode: "E010", points: 100 })

    const rewardId = await createReward({ db, pointCost: 50, stock: 1 })

    const requestFor = async (token: string) => {
      const requested = await request({
        db,
        path: "/thanks/redemptions",
        token,
        method: "POST",
        body: { reward_id: rewardId },
      })

      return z.object({ id: z.number() }).parse(await requested.json()).id
    }

    const recipientTokenValue = await recipientToken()
    const otherTokenValue = await otherRecipientToken()

    const firstId = await requestFor(recipientTokenValue)
    const secondId = await requestFor(otherTokenValue)

    const adminTokenValue = await adminToken()

    const approve = (id: number) =>
      request({
        db,
        path: `/thanks/redemptions/${id}/approve`,
        token: adminTokenValue,
        method: "POST",
      })

    // 残高は別人なので両方とも確定はできる（残高ガードでは弾かれない）。在庫1なので減算は1件だけ成功し、
    // もう1件は条件付き UPDATE が 0 行で在庫を減らさない。確定は両方維持され、在庫はマイナスにならない。
    const responses = await Promise.all([approve(firstId), approve(secondId)])

    expect(responses.every((response) => response.status === 200)).toBe(true)

    const rewardRow = await db
      .prepare("SELECT stock FROM thanks_rewards WHERE id = ?")
      .bind(rewardId)
      .first<{ stock: number }>()

    // 在庫は 1 から 0 までしか減らない（マイナスにならない）。
    expect(rewardRow?.stock).toBe(0)
    expect(rewardRow?.stock).toBeGreaterThanOrEqual(0)
  })
})
