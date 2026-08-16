import type { CertificateRequest } from "@/contexts/certificate-request/domain/certificate-request.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/certificate-request-repository"

export type Command = {
  requesterId: number
  limit: number
  offset: number
}

/**
 * 依頼者本人の証明書発行依頼を一覧する。
 */
export class ListMyCertificateRequests {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<CertificateRequest> | ApplicationError> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const certificateRequests = await certificateRequestRepository.findByRequesterId({
      requesterId: command.requesterId,
      limit: command.limit,
      offset: command.offset,
    })

    if (certificateRequests instanceof Error) {
      return new UnexpectedError("failed to find certificate requests", {
        cause: certificateRequests,
      })
    }

    return certificateRequests
  }
}
