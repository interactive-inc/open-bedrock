import type { CertificateRequest } from "@/domain/certificate-request/certificate-request"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/infrastructure/certificate-request/certificate-request-repository"

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

  async run(command: Command): Promise<ReadonlyArray<CertificateRequest> | Error> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    return await certificateRequestRepository.findByRequesterId({
      requesterId: command.requesterId,
      limit: command.limit,
      offset: command.offset,
    })
  }
}
