import { CertificationRepository } from "@/contexts/certification/infrastructure/certification.repository"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Certification } from "@/contexts/certification/domain/certification.entity"
import type { Context } from "@/env"

/**
 * 資格マスタを新規作成する。code は一意。重複時は conflict を返す。
 */
export class CreateCertification {
  constructor(private readonly c: Context) {}

  async run(props: {
    code: string
    name: string
    issuer: string | null
    description: string | null
    createdAt: string
  }): Promise<Certification | ApplicationError> {
    const repository = new CertificationRepository(this.c)

    const existing = await repository.findByCode(props.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load certification", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("certification code already exists", "certification_code_conflict")
    }

    const created = await repository.create(props)

    if (created instanceof Error) {
      return new UnexpectedError("failed to save certification", { cause: created })
    }

    return created
  }
}
