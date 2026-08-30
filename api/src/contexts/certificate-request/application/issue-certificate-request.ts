import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/repositories/certificate-request.repository"

export type Command = {
  session: CompanySessionValue
  certificateRequestId: string
}

/** 証明書を発行する。 */
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

    const updated = await certificateRequestRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
    })

    if (updated instanceof Error) {
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
