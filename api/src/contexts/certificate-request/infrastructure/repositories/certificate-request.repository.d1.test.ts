import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/repositories/certificate-request.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["create-update"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("CertificateRequestRepository on local D1", () => {
  test("create persists a requested request and update changes only a requested row", async () => {
    const { context, db } = await createLocalD1Context(local, "create-update")

    const repository = new CertificateRequestRepository(context)

    const created = await repository.create(
      CertificateRequest.create({
        requesterId: toWorkforceEmployeeId(5),
        certificateType: "employment",
        submitTo: "City Hall",
        neededBy: "2026-06-20",
        note: "For childcare application",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) throw created

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) throw new Error("request not found")

    expect(found.status).toBe("requested")
    expect(found.submitTo).toBe("City Hall")

    const updated = await repository.update(
      found.withDetails({
        certificateType: "retirement",
        submitTo: "Pension Office",
        neededBy: "2026-07-05",
        note: null,
      }),
    )

    if (updated instanceof Error || updated === null) throw new Error("update failed")

    expect(updated.certificateType).toBe("retirement")
    expect(updated.submitTo).toBe("Pension Office")

    await db
      .prepare("UPDATE certificate_requests SET status = 'issued' WHERE id = ?1")
      .bind(created.id)
      .run()

    const rejected = await repository.update(
      updated.withDetails({
        certificateType: "income",
        submitTo: null,
        neededBy: null,
        note: null,
      }),
    )

    expect(rejected).toBeNull()

    const stored = await db
      .prepare("SELECT certificate_type FROM certificate_requests WHERE id = ?1")
      .bind(created.id)
      .first<string>("certificate_type")

    expect(stored).toBe("retirement")
  })
})
