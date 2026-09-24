import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateCertificateRequest } from "@/contexts/certificate-request/application/create-certificate-request"
import { UpdateCertificateRequest } from "@/contexts/certificate-request/application/update-certificate-request"
import { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import { ApplicationError, ConflictError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

/** 証明書発行依頼のRepositoryを型付きfakeにして、application の業務判断だけを検証する。 */
function createRepository() {
  const stored = new Map<string, CertificateRequest>()

  return {
    stored,
    repository: {
      create: async (request: CertificateRequest) => {
        stored.set(request.id, request)
        return request
      },
      findById: async (id: string) => stored.get(id) ?? null,
      update: async (request: CertificateRequest) => {
        if (stored.get(request.id)?.status !== "requested") return null
        stored.set(request.id, request)
        return request
      },
    },
  }
}

function seedRequest(
  stored: Map<string, CertificateRequest>,
  requesterId: number,
  status: "requested" | "issued" = "requested",
): string {
  const request = new CertificateRequest({
    ...CertificateRequest.create({
      requesterId: toWorkforceEmployeeId(requesterId),
      certificateType: "employment",
      submitTo: "City Hall",
      neededBy: "2026-06-20",
      note: "For childcare application",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    status,
  })

  stored.set(request.id, request)

  return request.id
}

describe("CreateCertificateRequest", () => {
  test("creates a certificate request with status requested", async () => {
    const { repository, stored } = createRepository()

    const created = await new CreateCertificateRequest({
      certificateRequestRepository: repository,
    }).run({
      requesterId: toWorkforceEmployeeId(2),
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
    expect(stored.get(created.id)).toBe(created)
  })
})

describe("UpdateCertificateRequest", () => {
  test("updates the details for the requester", async () => {
    const { repository, stored } = createRepository()

    const requestId = seedRequest(stored, 5)

    const result = await new UpdateCertificateRequest({
      certificateRequestRepository: repository,
    }).run({
      certificateRequestId: requestId,
      requesterId: toWorkforceEmployeeId(5),
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
    const { repository, stored } = createRepository()

    const requestId = seedRequest(stored, 5)

    const result = await new UpdateCertificateRequest({
      certificateRequestRepository: repository,
    }).run({
      certificateRequestId: requestId,
      requesterId: toWorkforceEmployeeId(6),
      certificateType: "retirement",
      submitTo: null,
      neededBy: null,
      note: null,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })

  test("rejects a request that is no longer requested with not_modifiable", async () => {
    const { repository, stored } = createRepository()

    const requestId = seedRequest(stored, 5, "issued")

    const result = await new UpdateCertificateRequest({
      certificateRequestRepository: repository,
    }).run({
      certificateRequestId: requestId,
      requesterId: toWorkforceEmployeeId(5),
      certificateType: "retirement",
      submitTo: null,
      neededBy: null,
      note: null,
    })

    expectApplicationError(result, ConflictError, "not_modifiable")
  })
})
