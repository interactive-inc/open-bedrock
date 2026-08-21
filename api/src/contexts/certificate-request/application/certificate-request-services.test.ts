import { describe, expect, test } from "bun:test"
import { CreateCertificateRequest } from "@/contexts/certificate-request/application/create-certificate-request"
import { UpdateCertificateRequest } from "@/contexts/certificate-request/application/update-certificate-request"
import { CertificateRequest } from "@/contexts/certificate-request/domain/certificate-request.entity"
import type { Context } from "@/env"
import { ApplicationError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { createTestContext } from "@/api/test/support/create-test-context"

async function seedRequest(context: Context, requesterId: number): Promise<string> {
  const created = await new CreateCertificateRequest(context).run({
    requesterId: requesterId,
    certificateType: "employment",
    submitTo: "City Hall",
    neededBy: "2026-06-20",
    note: "For childcare application",
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateCertificateRequest", () => {
  test("creates a certificate request with status requested", async () => {
    const { context } = createTestContext()

    const created = await new CreateCertificateRequest(context).run({
      requesterId: 2,
      certificateType: "income",
      submitTo: null,
      neededBy: null,
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(CertificateRequest)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.submitTo).toBe(null)
  })
})

describe("GetCertificateRequest", () => {})

describe("ListMyCertificateRequests", () => {})

describe("UpdateCertificateRequest", () => {
  test("updates the details for the requester", async () => {
    const { context } = createTestContext()

    const requestId = await seedRequest(context, 5)

    const result = await new UpdateCertificateRequest(context).run({
      certificateRequestId: requestId,
      requesterId: 5,
      certificateType: "retirement",
      submitTo: "Pension Office",
      neededBy: "2026-07-05",
      note: null,
    })

    expect(result).toBeInstanceOf(CertificateRequest)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.certificateType).toBe("retirement")
    expect(result.submitTo).toBe("Pension Office")
  })

  test("rejects a non requester with not_requester", async () => {
    const { context } = createTestContext()

    const requestId = await seedRequest(context, 5)

    const result = await new UpdateCertificateRequest(context).run({
      certificateRequestId: requestId,
      requesterId: 6,
      certificateType: "retirement",
      submitTo: null,
      neededBy: null,
      note: null,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })
})

describe("CancelCertificateRequest", () => {})
