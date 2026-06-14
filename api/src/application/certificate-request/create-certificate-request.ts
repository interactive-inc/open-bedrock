import { CertificateRequest } from "@/domain/certificate-request/certificate-request.entity"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/infrastructure/certificate-request/certificate-request-repository"

export type Command = {
  requesterId: number
  certificateType: string
  submitTo: string | null
  neededBy: string | null
  note: string | null
  createdAt: string
}

/**
 * 証明書発行依頼を作成する。status は "requested" で登録する。
 */
export class CreateCertificateRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<CertificateRequest | Error> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const certificateRequest = CertificateRequest.create({
      requesterId: command.requesterId,
      certificateType: command.certificateType,
      submitTo: command.submitTo,
      neededBy: command.neededBy,
      note: command.note,
      createdAt: command.createdAt,
    })

    return await certificateRequestRepository.create(certificateRequest)
  }
}
