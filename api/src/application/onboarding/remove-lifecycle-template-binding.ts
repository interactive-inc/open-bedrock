import type { Context, SessionPayload } from "@/env"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import { ApplicationError, ForbiddenError, UnexpectedError } from "@/lib/errors"

export class RemoveLifecycleTemplateBinding {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: SessionPayload
    templateCode: string
  }): Promise<{ removed: boolean } | ApplicationError> {
    if (!canManageOnboarding(command.session)) {
      return new ForbiddenError("cannot manage onboarding", "forbidden")
    }

    try {
      const removed = await this.c.env.DB.prepare(
        `DELETE FROM lifecycle_effect_template_bindings
         WHERE template_code = ?1
         RETURNING effect_type`,
      )
        .bind(command.templateCode)
        .first<string>("effect_type")

      return { removed: removed !== null }
    } catch (cause) {
      return new UnexpectedError("failed to remove lifecycle template binding", { cause })
    }
  }
}
