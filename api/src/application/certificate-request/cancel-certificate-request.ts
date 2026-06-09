import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/infrastructure/certificate-request/certificate-request-repository"

export type Command = {
  certificateRequestId: string
  requesterId: number
}

export type CertificateRequestNotFound = { reason: "certificate_request_not_found" }

export type NotRequester = { reason: "not_requester" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

/**
 * 証明書発行依頼を取消する。本人以外と、確定済み依頼の取消を拒否する。
 */
export class CancelCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | CertificateRequestNotFound | NotRequester | NotModifiable | Error> {
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

    if (current.status !== "requested") {
      return { reason: "not_modifiable" }
    }

    const deleted = await certificateRequestRepository.delete(command.certificateRequestId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
