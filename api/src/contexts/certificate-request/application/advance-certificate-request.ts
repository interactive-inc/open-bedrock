import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { CertificateRequest } from "@/contexts/certificate-request/domain/certificate-request.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/certificate-request-repository"

export type Action = "issue" | "reject"

export type Command = {
  session: Session
  certificateRequestId: string
  action: Action
}

/**
 * 人事が証明書発行依頼の状態を代理で進める。requested のみ issued/rejected へ遷移でき、
 * それ以外の現在状態からの遷移は 409 とする。
 */
export class AdvanceCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CertificateRequest | ApplicationError> {
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

    const next = command.action === "issue" ? current.withIssued() : current.withRejected()

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
