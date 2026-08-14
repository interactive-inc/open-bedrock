import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"
import { z } from "zod"

const jwtSecret = "thanks-points-test-secret"

/** seed: E001 Alex Carter（id 1, admin）, E004 Drew Sato（id 4, member）, E005 Emery Lane（id 5, member） */
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "root" })
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
    path: "/thanks-messages",
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
    path: "/thanks-rewards",
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

    const response = await request({
      db,
      path: "/thanks-point-budgets/me",
      token: await senderToken(),
    })

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

    const response = await request({
      db,
      path: "/thanks-point-budgets/me",
      token: await senderToken(),
    })

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
      path: "/thanks-point-budgets/me",
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

// 当月原資（送れる枠）と受領残高（もらった点数）は別概念であり、別リソースが返す。
// 片方の増減がもう片方へ漏れないことを固定する。
describe("budget and balance are separate concepts", () => {
  test("sending points drains the budget without touching the sender's balance", async () => {
    const db = await createTestDb()

    const senderTokenValue = await senderToken()

    await sendThanks({ db, token: senderTokenValue, recipientCode: "E005", points: 100 })

    const budget = await request({
      db,
      path: "/thanks-point-budgets/me",
      token: senderTokenValue,
    })

    const parsedBudget = z
      .object({ consumed_points: z.number(), remaining_points: z.number() })
      .parse(await budget.json())

    expect(parsedBudget.consumed_points).toBe(100)
    expect(parsedBudget.remaining_points).toBe(300)

    // 送った側の受領残高は 0 のまま。送付は原資を減らすだけで残高を動かさない。
    const balance = await request({
      db,
      path: "/thanks-point-balances/me",
      token: senderTokenValue,
    })

    const parsedBalance = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsedBalance.balance_points).toBe(0)
  })

  test("receiving points raises the balance without granting extra budget", async () => {
    const db = await createTestDb()

    const recipientTokenValue = await recipientToken()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const balance = await request({
      db,
      path: "/thanks-point-balances/me",
      token: recipientTokenValue,
    })

    const parsedBalance = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsedBalance.balance_points).toBe(100)

    // 受け取っても当月に送れる枠は既定の 400 のまま。受領は原資を増やさない。
    const budget = await request({
      db,
      path: "/thanks-point-budgets/me",
      token: recipientTokenValue,
    })

    const parsedBudget = z
      .object({ granted_points: z.number(), remaining_points: z.number() })
      .parse(await budget.json())

    expect(parsedBudget.granted_points).toBe(400)
    expect(parsedBudget.remaining_points).toBe(400)
  })

  test("balance carries across months while the budget resets", async () => {
    const db = await createTestDb()

    const recipientTokenValue = await recipientToken()

    // 前月に受領し、前月のうちに原資も使い切る。
    await sendThanks({
      db,
      token: await senderToken(),
      recipientCode: "E005",
      points: 100,
      now: "2026-01-15T00:00:00.000Z",
    })

    await sendThanks({
      db,
      token: recipientTokenValue,
      recipientCode: "E004",
      points: 400,
      now: "2026-01-20T00:00:00.000Z",
    })

    // 当月。原資は満額に戻る。
    const budget = await request({
      db,
      path: "/thanks-point-budgets/me",
      token: recipientTokenValue,
      now: "2026-02-01T00:00:00.000Z",
    })

    const parsedBudget = z
      .object({ period: z.string(), remaining_points: z.number() })
      .parse(await budget.json())

    expect(parsedBudget.period).toBe("2026-02")
    expect(parsedBudget.remaining_points).toBe(400)

    // 受領残高は月をまたいでも累積したまま（リセットされない）。
    const balance = await request({
      db,
      path: "/thanks-point-balances/me",
      token: recipientTokenValue,
      now: "2026-02-01T00:00:00.000Z",
    })

    const parsedBalance = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsedBalance.balance_points).toBe(100)
  })

  test("the budget resource no longer serves the balance at its old nested path", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks-point-budgets/me/balance",
      token: await recipientToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("balance", () => {
  test("accumulates received points", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 120 })

    const response = await request({
      db,
      path: "/thanks-point-balances/me",
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
      path: "/thanks-point-balances/me",
      token: await recipientToken(),
    })

    const parsed = z.object({ balance_points: z.number() }).parse(await response.json())

    expect(parsed.balance_points).toBe(0)
  })

  test("pending redemption reduces the visible balance", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requested = await request({
      db,
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(requested.status).toBe(201)

    // pending 状態でも残高は差し引かれている。
    const balance = await request({
      db,
      path: "/thanks-point-balances/me",
      token: await recipientToken(),
    })

    const parsed = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsed.balance_points).toBe(40)
  })
})

describe("rewards", () => {
  test("admin can create a reward and members can list it", async () => {
    const db = await createTestDb()

    const created = await request({
      db,
      path: "/thanks-rewards",
      token: await adminToken(),
      method: "POST",
      body: { name: "図書カード", point_cost: 50, stock: 10 },
    })

    expect(created.status).toBe(201)

    const list = await request({ db, path: "/thanks-rewards", token: await senderToken() })

    const parsed = z
      .object({
        data: z.array(z.object({ name: z.string(), point_cost: z.number() })),
        total: z.number(),
      })
      .parse(await list.json())

    expect(parsed.data.length).toBe(1)
    expect(parsed.data[0]?.point_cost).toBe(50)
  })

  test("non-admin cannot create a reward", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks-rewards",
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
      path: "/thanks-rewards",
      token: await adminToken(),
      method: "POST",
      body: { name: "景品", point_cost: 0, stock: null },
    })

    expect(response.status).toBe(400)
  })

  test("?limit=1 returns only the first reward when 2 exist", async () => {
    const db = await createTestDb()

    // Create two rewards.
    await request({
      db,
      path: "/thanks-rewards",
      token: await adminToken(),
      method: "POST",
      body: { name: "図書カード", point_cost: 50, stock: null },
    })

    await request({
      db,
      path: "/thanks-rewards",
      token: await adminToken(),
      method: "POST",
      body: { name: "クオカード", point_cost: 100, stock: null },
    })

    const list = await request({ db, path: "/thanks-rewards?limit=1", token: await senderToken() })

    expect(list.status).toBe(200)

    const parsed = z
      .object({ data: z.array(z.object({ name: z.string() })), total: z.number() })
      .parse(await list.json())

    expect(parsed.data.length).toBe(1)
  })
})

describe("redemption", () => {
  test("approves a redemption and deducts from balance", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requested = await request({
      db,
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(requested.status).toBe(201)

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const approved = await request({
      db,
      path: `/thanks-redemptions/${redemptionId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(approved.status).toBe(200)

    const balance = await request({
      db,
      path: "/thanks-point-balances/me",
      token: await recipientToken(),
    })

    const parsed = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsed.balance_points).toBe(40)
  })

  test("rejects a redemption request when balance is insufficient", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 30 })

    const rewardId = await createReward({ db, pointCost: 100 })

    const response = await request({
      db,
      path: "/thanks-redemptions",
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
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const first = await request({
      db,
      path: `/thanks-redemptions/${redemptionId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await request({
      db,
      path: `/thanks-redemptions/${redemptionId}/approve`,
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
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(first.status).toBe(201)

    // pending が既に存在するため 2 件目は 409 で弾かれる。
    const second = await request({
      db,
      path: "/thanks-redemptions",
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
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(first.status).toBe(201)

    const firstId = z.object({ id: z.number() }).parse(await first.json()).id

    // 1 件目を承認して pending を解消する。
    const approved = await request({
      db,
      path: `/thanks-redemptions/${firstId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(approved.status).toBe(200)

    // pending が無くなったので 2 件目を申請できる。
    const second = await request({
      db,
      path: "/thanks-redemptions",
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
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const rejected = await request({
      db,
      path: `/thanks-redemptions/${redemptionId}/reject`,
      token: await adminToken(),
      method: "POST",
    })

    expect(rejected.status).toBe(200)

    const balance = await request({
      db,
      path: "/thanks-point-balances/me",
      token: await recipientToken(),
    })

    const parsed = z.object({ balance_points: z.number() }).parse(await balance.json())

    expect(parsed.balance_points).toBe(100)
  })

  test("non-admin cannot approve a redemption", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    const requested = await request({
      db,
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    const response = await request({
      db,
      path: `/thanks-redemptions/${redemptionId}/approve`,
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
      path: "/thanks-redemptions",
      token: await adminToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(requested.status).toBe(201)

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    // admin 本人が承認しようとすると 403 で弾かれる。
    const response = await request({
      db,
      path: `/thanks-redemptions/${redemptionId}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("forbids the applicant from rejecting their own redemption", async () => {
    const db = await createTestDb()

    // admin(E001) にポイントを付与する。
    await sendThanks({ db, token: await senderToken(), recipientCode: "E001", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    // admin 自身が交換申請を出す。
    const requested = await request({
      db,
      path: "/thanks-redemptions",
      token: await adminToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(requested.status).toBe(201)

    const redemptionId = z.object({ id: z.number() }).parse(await requested.json()).id

    // 却下も決裁行為。admin 本人が却下しようとすると 403 で弾かれる。
    const response = await request({
      db,
      path: `/thanks-redemptions/${redemptionId}/reject`,
      token: await adminToken(),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("rejects an invalid redemption id", async () => {
    const db = await createTestDb()

    const response = await request({
      db,
      path: "/thanks-redemptions/0/approve",
      token: await adminToken(),
      method: "POST",
    })

    expect(response.status).toBe(400)
  })
})

describe("redemption pagination", () => {
  const redemptionListSchema = z.object({
    data: z.array(z.object({ id: z.number(), employee_id: z.number(), status: z.string() })),
    total: z.number(),
  })

  /** 同時 pending は 1 件までなので、申請→却下で解決済みの交換を 1 件積み増す。 */
  async function createRejectedRedemption(props: {
    db: D1Database
    recipientTokenValue: string
    rewardId: number
  }): Promise<void> {
    const requested = await request({
      db: props.db,
      path: "/thanks-redemptions",
      token: props.recipientTokenValue,
      method: "POST",
      body: { reward_id: props.rewardId },
    })

    const id = z.object({ id: z.number() }).parse(await requested.json()).id

    await request({
      db: props.db,
      path: `/thanks-redemptions/${id}/reject`,
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
      path: "/thanks-redemptions/me?limit=2",
      token: recipientTokenValue,
    })

    expect(page1.status).toBe(200)

    const list1 = redemptionListSchema.parse(await page1.json())

    expect(list1.data.length).toBe(2)

    const page2 = await request({
      db,
      path: "/thanks-redemptions/me?limit=2&offset=2",
      token: recipientTokenValue,
    })

    expect(page2.status).toBe(200)

    const list2 = redemptionListSchema.parse(await page2.json())

    expect(list2.data.length).toBe(1)

    // ページ間で id が重複しない（新しい順）。
    expect(list1.data.map((row) => row.id)).not.toContain(list2.data[0]?.id)
  })

  test("limits and offsets the pending inbox", async () => {
    const db = await createTestDb()

    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })
    await sendThanks({ db, token: await senderToken(), recipientCode: "E010", points: 100 })

    const rewardId = await createReward({ db, pointCost: 10 })

    // 異なる社員がそれぞれ pending を 1 件ずつ持つ（合計 2 件）。
    await request({
      db,
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    await request({
      db,
      path: "/thanks-redemptions",
      token: await otherRecipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    const page1 = await request({
      db,
      path: "/thanks-redemptions/inbox?limit=1",
      token: await adminToken(),
    })

    expect(page1.status).toBe(200)

    const list1 = redemptionListSchema.parse(await page1.json())

    expect(list1.data.length).toBe(1)

    const page2 = await request({
      db,
      path: "/thanks-redemptions/inbox?limit=1&offset=1",
      token: await adminToken(),
    })

    expect(page2.status).toBe(200)

    const list2 = redemptionListSchema.parse(await page2.json())

    expect(list2.data.length).toBe(1)
    expect(list1.data[0]?.id).not.toBe(list2.data[0]?.id)
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
        path: "/thanks-redemptions",
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
        path: "/thanks-messages",
        token: senderTokenValue,
        method: "POST",
        body: { recipient_employee_code: "E005", message: "ありがとう", points: 300 },
      })

    const responses = await Promise.all([sendOnce(), sendOnce()])

    const statuses = responses
      .map((response) => response.status)
      .sort((left, right) => left - right)

    expect(statuses).toEqual([201, 400])

    const budget = await request({ db, path: "/thanks-point-budgets/me", token: senderTokenValue })

    const parsed = z
      .object({ remaining_points: z.number(), consumed_points: z.number() })
      .parse(await budget.json())

    expect(parsed.consumed_points).toBe(300)
    expect(parsed.remaining_points).toBe(100)
    expect(parsed.remaining_points).toBeGreaterThanOrEqual(0)
  })

  // 在庫1の景品に対し、各々残高十分な2人が同時に交換確定しようとしても、承認は1件だけ成立する。
  test("rejects one concurrent approval when finite stock is exhausted", async () => {
    const db = await createTestDb()

    // E005 と E010 にそれぞれ十分な残高を配る。
    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })
    await sendThanks({ db, token: await senderToken(), recipientCode: "E010", points: 100 })

    const rewardId = await createReward({ db, pointCost: 50, stock: 1 })

    const requestFor = async (token: string) => {
      const requested = await request({
        db,
        path: "/thanks-redemptions",
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
        path: `/thanks-redemptions/${id}/approve`,
        token: adminTokenValue,
        method: "POST",
      })

    const responses = await Promise.all([approve(firstId), approve(secondId)])

    const statuses = responses
      .map((response) => response.status)
      .sort((left, right) => left - right)

    expect(statuses).toEqual([200, 409])

    const rewardRow = await db
      .prepare("SELECT stock FROM thanks_rewards WHERE id = ?")
      .bind(rewardId)
      .first<{ stock: number }>()

    expect(rewardRow?.stock).toBe(0)
    expect(rewardRow?.stock).toBeGreaterThanOrEqual(0)
  })

  // approveFromPending の残高サブクエリが fulfilled + pending を差し引くことを確認する。
  // DB に直接 pending 行を追加し、その分を考慮すると残高不足になるシナリオで承認が拒否されることをテスト。
  // 部分 unique インデックスを一時的に外して同一社員に 2 pending を作る。
  test("approval considers other pending redemptions in the balance check", async () => {
    const db = await createTestDb()

    // E005 に 100pt 付与。
    await sendThanks({ db, token: await senderToken(), recipientCode: "E005", points: 100 })

    const rewardId = await createReward({ db, pointCost: 60 })

    // API 経由で 60pt の pending を 1 件作成。
    const requested = await request({
      db,
      path: "/thanks-redemptions",
      token: await recipientToken(),
      method: "POST",
      body: { reward_id: rewardId },
    })

    expect(requested.status).toBe(201)

    // 部分 unique インデックスを一時的に削除して 2 件目の pending を挿入可能にする。
    await db.prepare("DROP INDEX IF EXISTS idx_thanks_redemptions_employee_pending").run()

    // DB に直接 2 件目の pending（60pt）を挿入。
    // これで合計 pending = 120pt > 残高 100pt。
    await db
      .prepare(
        `INSERT INTO thanks_redemptions (employee_id, reward_id, point_cost, status, created_at)
         VALUES (?, ?, ?, 'pending', datetime('now'))`,
      )
      .bind(5, rewardId, 60)
      .run()

    // 2 件目の pending の id を取得。
    const secondRow = await db
      .prepare(
        "SELECT id FROM thanks_redemptions WHERE employee_id = 5 AND status = 'pending' ORDER BY id DESC LIMIT 1",
      )
      .first<{ id: number }>()

    // 2 件目を承認しようとする。1 件目の pending（60pt）があるため実効残高は 40pt。
    // 60pt の承認は残高不足で弾かれるべき。
    const approved = await request({
      db,
      path: `/thanks-redemptions/${secondRow?.id}/approve`,
      token: await adminToken(),
      method: "POST",
    })

    // 残高不足で 0 行更新 → 409。
    expect(approved.status).toBe(409)
  })
})
