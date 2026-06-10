import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedRooms } from "@/infrastructure/seed/seed-rooms"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { factory } from "@/lib/factory"
import * as roomsRoute from "@/interface/room/rooms/route"
import * as roomDetailRoute from "@/interface/room/rooms/[id]/route"
import { z } from "zod"

// app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
// 会議室マスタのハンドラだけを載せて検証する。固有パスとの衝突を避けるため :id は最後に並べる。
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
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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
      NOW: "2026-01-01T00:00:00.000Z",
    },
  )
}

describe("GET /rooms", () => {
  test("returns all rooms for any signed-in member", async () => {
    const response = await request({ path: "/rooms", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z.array(roomResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(5)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/rooms", token: null })

    expect(response.status).toBe(401)
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
})
