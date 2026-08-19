import type { NotificationReadBatchEntity } from "@/contexts/system/domain/notifications/notification-read.entity"
import { NotificationReadWriteError } from "@/contexts/system/infrastructure/notifications/errors"
import { chunkArray } from "@/lib/collection/chunk-array"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { notificationReads } from "@/contexts/system/infrastructure/schema/system-runtime"

export class NotificationReadRepository {
  constructor(private readonly c: SystemDatabaseContext) {}

  async write(entity: NotificationReadBatchEntity): Promise<number | NotificationReadWriteError> {
    if (entity.reads.length === 0) {
      return 0
    }

    try {
      const insertResults = await Promise.all(
        chunkArray(entity.reads, 19).map((chunk) =>
          this.c.var.database
            .insert(notificationReads)
            .values(chunk)
            .onConflictDoNothing()
            .returning({ id: notificationReads.id }),
        ),
      )

      return insertResults.reduce((sum, inserted) => sum + inserted.length, 0)
    } catch (error) {
      return new NotificationReadWriteError(entity.reads[0]!.userId, error)
    }
  }
}
