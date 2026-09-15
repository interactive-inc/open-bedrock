import { skillFactory } from "@/contexts/skill/interface/request-environment/skill-factory"
import { createSkillSourceFreezeHandlers } from "@/contexts/skill/interface/operations/create-skill-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = skillFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSkillSourceFreezeHandlers("release"),
)
