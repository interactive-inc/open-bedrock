import { canManageLifeEvents } from "@/lib/life-event/can-manage-life-events"
import { LifeEvent } from "@/domain/life-event/life-event.entity"
import type { Context, SessionPayload } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LifeEventRepository } from "@/infrastructure/life-event/life-event-repository"

export type Action = "approve" | "reject"

export type Command = {
  session: SessionPayload
  lifeEventId: string
  action: Action
}

/**
 * 人事がライフイベント届出の状態を代理で進める。submitted のみ approved/rejected へ遷移でき、
 * それ以外の現在状態からの遷移は 409 とする。
 */
export class AdvanceLifeEvent {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LifeEvent | ApplicationError> {
    if (canManageLifeEvents(command.session) === false) {
      return new ForbiddenError("cannot manage life events", "forbidden")
    }

    const lifeEventRepository = new LifeEventRepository(this.c)

    const current = await lifeEventRepository.findById(command.lifeEventId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find life event", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("life event not found", "life_event_not_found")
    }

    const next = command.action === "approve" ? current.withApproved() : current.withRejected()

    if (next instanceof LifeEvent === false) {
      return new ConflictError("life event is not in a transitionable state", next.reason)
    }

    const updated = await lifeEventRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update life event status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("life event is not in a transitionable state", "invalid_transition")
    }

    return updated
  }
}
