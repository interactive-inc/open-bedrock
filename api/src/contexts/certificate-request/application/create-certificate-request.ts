import { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/certificate-request.repository"

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

  async run(command: Command): Promise<CertificateRequest | ApplicationError> {
    const certificateRequestRepository = new CertificateRequestRepository(this.c)

    const certificateRequest = CertificateRequest.create({
      requesterId: command.requesterId,
      certificateType: command.certificateType,
      submitTo: command.submitTo,
      neededBy: command.neededBy,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await certificateRequestRepository.create(certificateRequest)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create certificate request", { cause: created })
    }

    return created
  }
}
