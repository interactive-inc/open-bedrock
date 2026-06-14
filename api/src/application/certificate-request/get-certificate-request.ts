import type { CertificateRequest } from "@/domain/certificate-request/certificate-request.entity"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/infrastructure/certificate-request/certificate-request-repository"

export type Command = {
  certificateRequestId: string
  requesterId: number
}

export type CertificateRequestNotFound = { reason: "certificate_request_not_found" }

export type NotRequester = { reason: "not_requester" }

/**
 * 証明書発行依頼を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<CertificateRequest | CertificateRequestNotFound | NotRequester | Error> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const certificateRequest = await certificateRequestRepository.findById(
      command.certificateRequestId,
    )

    if (certificateRequest instanceof Error) {
      return certificateRequest
    }

    if (certificateRequest === null) {
      return { reason: "certificate_request_not_found" }
    }

    if (certificateRequest.requesterId !== command.requesterId) {
      return { reason: "not_requester" }
    }

    return certificateRequest
  }
}
