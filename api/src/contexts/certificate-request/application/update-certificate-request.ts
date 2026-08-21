import type { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/certificate-request.repository"

export type Command = {
  certificateRequestId: string
  requesterId: number
  certificateType: string
  submitTo: string | null
  neededBy: string | null
  note: string | null
}

/**
 * 証明書発行依頼の種別・提出先・希望日・備考を変更する。本人以外と、確定済み依頼の変更を拒否する。
 */
export class UpdateCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CertificateRequest | ApplicationError> {
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

    const updated = current.withDetails({
      certificateType: command.certificateType,
      submitTo: command.submitTo,
      neededBy: command.neededBy,
      note: command.note,
    })

    const result = await certificateRequestRepository.update(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update certificate request", { cause: result })
    }

    if (result === null) {
      return new ConflictError("certificate request is not modifiable", "not_modifiable")
    }

    return result
  }
}
