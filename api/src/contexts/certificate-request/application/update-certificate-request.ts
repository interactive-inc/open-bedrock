import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/repositories/certificate-request.repository"
import { isCertificateRequestRecordSourceFrozenError } from "@/contexts/certificate-request/infrastructure/repositories/lib/is-certificate-request-record-source-frozen-error"

type Context = Readonly<{
  certificateRequestRepository: Pick<CertificateRequestRepository, "findById" | "update">
}>

export type Command = {
  certificateRequestId: string
  requesterId: EmployeeId
  certificateType: string
  submitTo: string | null
  neededBy: string | null
  note: string | null
}

/**
 * 証明書発行依頼の種別・提出先・希望日・備考を変更する。本人以外と、確定済み依頼の変更を拒否する。
 */
export class UpdateCertificateRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<CertificateRequest | ApplicationError> {
    const current = await this.c.certificateRequestRepository.findById(command.certificateRequestId)

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

    const result = await this.c.certificateRequestRepository.update(updated)

    if (result instanceof Error) {
      if (isCertificateRequestRecordSourceFrozenError(result)) {
        return new ConflictError("certificate request writes are frozen", "record_source_frozen", {
          cause: result,
        })
      }
      return new UnexpectedError("failed to update certificate request", { cause: result })
    }

    if (result === null) {
      return new ConflictError("certificate request is not modifiable", "not_modifiable")
    }

    return result
  }
}
