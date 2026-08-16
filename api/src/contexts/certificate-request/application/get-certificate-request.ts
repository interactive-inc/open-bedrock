import type { CertificateRequest } from "@/contexts/certificate-request/domain/certificate-request.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/certificate-request-repository"

export type Command = {
  certificateRequestId: string
  requesterId: number
}

/**
 * 証明書発行依頼を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CertificateRequest | ApplicationError> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const certificateRequest = await certificateRequestRepository.findById(
      command.certificateRequestId,
    )

    if (certificateRequest instanceof Error) {
      return new UnexpectedError("failed to find certificate request", {
        cause: certificateRequest,
      })
    }

    if (certificateRequest === null) {
      return new NotFoundError("certificate request not found", "certificate_request_not_found")
    }

    if (certificateRequest.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    return certificateRequest
  }
}
