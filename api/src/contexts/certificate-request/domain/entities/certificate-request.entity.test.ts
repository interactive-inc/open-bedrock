import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import { describe, expect, test } from "bun:test"

describe("CertificateRequest.create", () => {
  test("builds with UUID id and requested status", () => {
    const request = CertificateRequest.create({
      requesterId: toWorkforceEmployeeId(1),
      certificateType: "在籍証明書",
      submitTo: "銀行",
      neededBy: "2026-07-15",
      note: "住宅ローン用",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(request).toBeInstanceOf(CertificateRequest)
    expect(request.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(request.status).toBe("requested")
    expect(request.requesterId).toBe(toWorkforceEmployeeId(1))
    expect(request.certificateType).toBe("在籍証明書")
    expect(request.submitTo).toBe("銀行")
    expect(request.neededBy).toBe("2026-07-15")
    expect(request.note).toBe("住宅ローン用")
  })
})

describe("CertificateRequest.withDetails", () => {
  test("returns new instance with updated fields", () => {
    const request = CertificateRequest.create({
      requesterId: toWorkforceEmployeeId(1),
      certificateType: "在籍証明書",
      submitTo: "銀行",
      neededBy: "2026-07-15",
      note: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    const updated = request.withDetails({
      certificateType: "源泉徴収票",
      submitTo: null,
      neededBy: "2026-08-01",
      note: "確定申告用",
    })

    expect(updated).toBeInstanceOf(CertificateRequest)
    expect(updated.certificateType).toBe("源泉徴収票")
    expect(updated.submitTo).toBe(null)
    expect(updated.neededBy).toBe("2026-08-01")
    expect(updated.note).toBe("確定申告用")
    expect(updated.requesterId).toBe(toWorkforceEmployeeId(1))
    expect(updated.status).toBe("requested")
  })
})
