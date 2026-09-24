import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/repositories/certificate-request.repository"
import { isCertificateRequestRecordSourceFrozenError } from "@/contexts/certificate-request/infrastructure/repositories/lib/is-certificate-request-record-source-frozen-error"
import { CertificateRequestDecisionAuthorityAdapter } from "@/contexts/certificate-request/infrastructure/adapters/certificate-request-decision-authority.adapter"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"

export type Command = {
  session: CompanySessionValue
  certificateRequestId: string
}

/** 証明書を、技術的権限と依頼者に対するCompany上の管理範囲の両方を満たす判断者が発行する。 */
export class IssueCertificateRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<CertificateRequest | ApplicationError> {
    if (command.session.hasPermission("certificate_request:manage") === false) {
      return new ForbiddenError("cannot manage certificate requests", "forbidden")
    }

    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const current = await certificateRequestRepository.findById(command.certificateRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find certificate request", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("certificate request not found", "certificate_request_not_found")
    }

    const next = current.withIssued()

    if (next instanceof CertificateRequest === false) {
      return new ConflictError("certificate request is not in a transitionable state", next.reason)
    }

    const authority = await new CertificateRequestDecisionAuthorityAdapter(this.c).prepare({
      session: command.session,
      subjectEmployeeId: current.requesterId,
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    const updated = await certificateRequestRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
      guards: authority.guards,
    })

    if (updated instanceof Error) {
      if (isCompanyWriteAbortedByGuard(updated)) {
        return new ConflictError(
          "company authority changed before saving",
          "company_authority_changed",
          {
            cause: updated,
          },
        )
      }
      if (isCertificateRequestRecordSourceFrozenError(updated)) {
        return new ConflictError("certificate request writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      }
      return new UnexpectedError("failed to update certificate request status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError(
        "certificate request is not in a transitionable state",
        "invalid_transition",
      )
    }

    return updated
  }
}
