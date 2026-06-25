import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/infrastructure/certificate-request/certificate-request-repository"

export type Command = {
  certificateRequestId: string
  requesterId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 証明書発行依頼を取消する。本人以外と、確定済み依頼の取消を拒否する。
 */
export class CancelCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const current = await certificateRequestRepository.findById(command.certificateRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find certificate request", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("certificate request not found", "certificate_request_not_found")
    }

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("certificate request is not modifiable", "not_modifiable")
    }

    const deleted = await certificateRequestRepository.delete(command.certificateRequestId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete certificate request", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("certificate request is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}
