import type { CertificateRequest } from "@/domain/certificate-request/certificate-request"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/infrastructure/certificate-request/certificate-request-repository"

export type Command = {
  certificateRequestId: string
  requesterId: number
  certificateType: string
  submitTo: string | null
  neededBy: string | null
  note: string | null
}

export type CertificateRequestNotFound = { reason: "certificate_request_not_found" }

export type NotRequester = { reason: "not_requester" }

/**
 * 証明書発行依頼の種別・提出先・希望日・備考を変更する。本人以外の変更を拒否する。
 */
export class UpdateCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<CertificateRequest | CertificateRequestNotFound | NotRequester | Error> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const current = await certificateRequestRepository.findById(command.certificateRequestId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "certificate_request_not_found" }
    }

    if (current.requesterId !== command.requesterId) {
      return { reason: "not_requester" }
    }

    const updated = current.withDetails({
      certificateType: command.certificateType,
      submitTo: command.submitTo,
      neededBy: command.neededBy,
      note: command.note,
    })

    return await certificateRequestRepository.update(updated)
  }
}
