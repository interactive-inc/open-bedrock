import { describe, expect, test } from "bun:test"
import { seedBatchJobs } from "@/api/test/support/seed-batch-jobs"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const batchJobResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  message: z.string().nullable(),
})

const jwtSecret = "batch-route-test-secret"

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
    "batch_jobs",
    seedBatchJobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      started_at: job.startedAt,
      finished_at: job.finishedAt,
      message: job.message,
    })),
  )

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

function employeeToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /batch", () => {
  test("returns 200 with an array in the CLI snake_case shape", async () => {
    const response = await request("/batch", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(batchJobResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(seedBatchJobs.length)

      const completed = parsed.data.data.find((job) => job.id === 1)

      expect(completed?.started_at).toBe("2026-05-29T18:00:00Z")
      expect(completed?.finished_at).toBe("2026-05-29T18:05:00Z")

      const running = parsed.data.data.find((job) => job.status === "running")

      expect(running?.finished_at).toBeNull()
      expect(running?.message).toBeNull()
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/batch", null)

    expect(response.status).toBe(401)
  })

  test("returns 401 with an invalid bearer token", async () => {
    const response = await request("/batch", "not-a-real-token")

    expect(response.status).toBe(401)
  })

  test("returns 403 for a non-privileged role (employee)", async () => {
    const response = await request("/batch", await employeeToken())

    expect(response.status).toBe(403)
  })
})
