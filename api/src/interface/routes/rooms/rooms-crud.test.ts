import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedRoomReservations } from "@/infrastructure/seed/seed-room-reservations"
import { seedRooms } from "@/infrastructure/seed/seed-rooms"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/interface/middleware/database-middleware"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { factory } from "@/lib/factory"
import * as roomsRoute from "@/interface/routes/rooms/route"
import * as roomDetailRoute from "@/interface/routes/rooms/[id]/route"
import { z } from "zod"

/**
 * app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
 * 会議室マスタのハンドラだけを載せて検証する。固有パスとの衝突を避けるため :id は最後に並べる。
 */
const app = factory
  .createApp()
  .use("*", cors())
  .use("*", contextStorage())
  .use("*", databaseMiddleware)
  .onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status)
    }

    return c.json({ error: "internal server error" }, 500)
  })
  .get("/rooms", ...roomsRoute.GET)
  .post("/rooms", ...roomsRoute.POST)
  .get("/rooms/:id", ...roomDetailRoute.GET)
  .put("/rooms/:id", ...roomDetailRoute.PUT)
  .delete("/rooms/:id", ...roomDetailRoute.DELETE)

const roomResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  capacity: z.number(),
  location: z.string().nullable(),
})

const jwtSecret = "rooms-crud-test-secret"

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

  await seedD1(
    db,
    "rooms",
    seedRooms.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      location: room.location,
    })),
  )

  await seedD1(
    db,
    "room_reservations",
    seedRoomReservations.map((reservation) => ({
      id: reservation.id,
      room_id: reservation.roomId,
      reserver_id: reservation.reserverId,
      start_at: reservation.startAt,
      end_at: reservation.endAt,
      purpose: reservation.purpose,
    })),
  )

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  const headers: Record<string, string> = {}

  if (props.token !== null) {
    headers.Authorization = `Bearer ${props.token}`
  }

  if (props.body !== undefined) {
    headers["content-type"] = "application/json"
  }

  return app.request(
    props.path,
    {
      method: props.method ?? "GET",
      headers,
      body: props.body === undefined ? undefined : JSON.stringify(props.body),
    },
    {
      DB: await createTestDb(),
      JWT_SECRET: jwtSecret,
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  )
}

describe("GET /rooms", () => {
  test("returns all rooms for any signed-in member", async () => {
    const response = await request({ path: "/rooms", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(5)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/rooms", token: null })

    expect(response.status).toBe(401)
  })

  test("?limit=1 returns only 1 room when seed has 5", async () => {
    const response = await request({ path: "/rooms?limit=1", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
    }
  })
})

describe("GET /rooms/:id", () => {
  test("returns a single room", async () => {
    const response = await request({ path: "/rooms/1", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = roomResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
    }
  })

  test("returns 404 for an unknown room", async () => {
    const response = await request({ path: "/rooms/9999", token: await memberToken() })

    expect(response.status).toBe(404)
  })

  test("returns 400 for a non-numeric id", async () => {
    const response = await request({ path: "/rooms/abc", token: await memberToken() })

    expect(response.status).toBe(400)
  })
})

describe("POST /rooms", () => {
  test("creates a room for an admin and assigns an id", async () => {
    const response = await request({
      path: "/rooms",
      token: await adminToken(),
      method: "POST",
      body: { name: "New Project Room", capacity: 12, location: "6F" },
    })

    expect(response.status).toBe(201)

    const parsed = roomResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("New Project Room")
      expect(parsed.data.capacity).toBe(12)
      expect(parsed.data.id).toBeGreaterThan(0)
    }
  })

  test("accepts a null location", async () => {
    const response = await request({
      path: "/rooms",
      token: await adminToken(),
      method: "POST",
      body: { name: "Remote Room", capacity: 4, location: null },
    })

    expect(response.status).toBe(201)

    const parsed = roomResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.location).toBe(null)
    }
  })

  test("returns 403 for a non-privileged member", async () => {
    const response = await request({
      path: "/rooms",
      token: await memberToken(),
      method: "POST",
      body: { name: "New Project Room", capacity: 12, location: "6F" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/rooms",
      token: null,
      method: "POST",
      body: { name: "New Project Room", capacity: 12, location: "6F" },
    })

    expect(response.status).toBe(401)
  })
})

describe("PUT /rooms/:id", () => {
  test("updates a room for an admin", async () => {
    const response = await request({
      path: "/rooms/1",
      token: await adminToken(),
      method: "PUT",
      body: { name: "Large Meeting Room A (renovated)", capacity: 24, location: "5F" },
    })

    expect(response.status).toBe(200)

    const parsed = roomResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Large Meeting Room A (renovated)")
      expect(parsed.data.capacity).toBe(24)
    }
  })

  test("returns 403 for a non-privileged member", async () => {
    const response = await request({
      path: "/rooms/1",
      token: await memberToken(),
      method: "PUT",
      body: { name: "Hacked Room", capacity: 1, location: null },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown room", async () => {
    const response = await request({
      path: "/rooms/9999",
      token: await adminToken(),
      method: "PUT",
      body: { name: "Ghost Room", capacity: 5, location: null },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /rooms/:id", () => {
  test("deletes a room for an admin and returns 204", async () => {
    const response = await request({
      path: "/rooms/1",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 for a non-privileged member", async () => {
    const response = await request({
      path: "/rooms/1",
      token: await memberToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown room", async () => {
    const response = await request({
      path: "/rooms/9999",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/rooms/1", token: null, method: "DELETE" })

    expect(response.status).toBe(401)
  })

  test("deletes associated room_reservations when deleting a room", async () => {
    const db = await createTestDb()
    const token = await adminToken()

    // room 1 has 2 reservations in seed data (ids ...0001 and ...0003)
    const before = await db
      .prepare("SELECT COUNT(*) as cnt FROM room_reservations WHERE room_id = 1")
      .first<{ cnt: number }>()

    expect(before?.cnt).toBe(2)

    const response = await app.request(
      "/rooms/1",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
      {
        DB: db,
        JWT_SECRET: jwtSecret,
        AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
        NOW: "2026-01-01T00:00:00.000Z",
      },
    )

    expect(response.status).toBe(204)

    const after = await db
      .prepare("SELECT COUNT(*) as cnt FROM room_reservations WHERE room_id = 1")
      .first<{ cnt: number }>()

    expect(after?.cnt).toBe(0)

    // reservations for other rooms remain intact
    const otherRoom = await db
      .prepare("SELECT COUNT(*) as cnt FROM room_reservations WHERE room_id = 2")
      .first<{ cnt: number }>()

    expect(otherRoom?.cnt).toBe(1)
  })
})
