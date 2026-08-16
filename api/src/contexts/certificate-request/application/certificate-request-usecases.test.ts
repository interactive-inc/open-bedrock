import { describe, expect, test } from "bun:test"
import { CancelCertificateRequest } from "@/contexts/certificate-request/application/cancel-certificate-request"
import { CreateCertificateRequest } from "@/contexts/certificate-request/application/create-certificate-request"
import { GetCertificateRequest } from "@/contexts/certificate-request/application/get-certificate-request"
import { ListMyCertificateRequests } from "@/contexts/certificate-request/application/list-my-certificate-requests"
import { UpdateCertificateRequest } from "@/contexts/certificate-request/application/update-certificate-request"
import { CertificateRequest } from "@/contexts/certificate-request/domain/certificate-request.entity"
import type { Context } from "@/env"
import { ApplicationError, ForbiddenError, NotFoundError } from "@/lib/errors"
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

describe("GetCertificateRequest", () => {
  test("returns the request for its requester", async () => {
    const { context } = createTestContext()

    const requestId = await seedRequest(context, 5)

    const result = await new GetCertificateRequest(context).run({
      certificateRequestId: requestId,
      requesterId: 5,
    })

    expect(result).toBeInstanceOf(CertificateRequest)
  })

  test("rejects a non requester with not_requester", async () => {
    const { context } = createTestContext()

    const requestId = await seedRequest(context, 5)

    const result = await new GetCertificateRequest(context).run({
      certificateRequestId: requestId,
      requesterId: 6,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })

  test("returns certificate_request_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetCertificateRequest(context).run({
      certificateRequestId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      requesterId: 5,
    })

    expectApplicationError(result, NotFoundError, "certificate_request_not_found")
  })
})

describe("ListMyCertificateRequests", () => {
  test("returns only the requester's requests", async () => {
    const { context } = createTestContext()

    await seedRequest(context, 5)

    await seedRequest(context, 6)

    const result = await new ListMyCertificateRequests(context).run({
      requesterId: 5,
      limit: 50,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
    expect(result[0].requesterId).toBe(5)
  })
})

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

describe("CancelCertificateRequest", () => {
  test("cancels the request for the requester", async () => {
    const { context } = createTestContext()

    const requestId = await seedRequest(context, 5)

    const result = await new CancelCertificateRequest(context).run({
      certificateRequestId: requestId,
      requesterId: 5,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects a non requester with not_requester", async () => {
    const { context } = createTestContext()

    const requestId = await seedRequest(context, 5)

    const result = await new CancelCertificateRequest(context).run({
      certificateRequestId: requestId,
      requesterId: 6,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })
})
