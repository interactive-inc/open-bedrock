// このファイルは `bun run gen:composition` が生成する。手で編集しない。
import { runScheduledLeaveNotifications } from "@/api/scheduled/run-leave-notifications"
import { runScheduledOnboarding } from "@/api/scheduled/run-onboarding"

/** Workerの定期起動で実行するrunner。src/api/scheduled/run-*.ts から生成する。 */
export const SCHEDULED_JOBS = [
  runScheduledLeaveNotifications,
  runScheduledOnboarding,
] as const
