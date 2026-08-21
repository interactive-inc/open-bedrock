import { CertificationRepository } from "@/contexts/certification/infrastructure/certification.repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Certification } from "@/contexts/certification/domain/certification.entity"
import type { Context } from "@/env"

/**
 * 資格マスタの名称・発行元・説明を更新する。対象が無ければ not found を返す。
 */
export class UpdateCertification {
  constructor(private readonly c: Context) {}

  async run(props: {
    id: number
    name: string
    issuer: string | null
    description: string | null
  }): Promise<Certification | ApplicationError> {
    const repository = new CertificationRepository(this.c)

    const existing = await repository.findById(props.id)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load certification", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("certification not found", "certification_not_found")
    }

    const updated = await repository.update(
      existing.withDetails({
        name: props.name,
        issuer: props.issuer,
        description: props.description,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update certification", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("certification not found", "certification_not_found")
    }

    return updated
  }
}
