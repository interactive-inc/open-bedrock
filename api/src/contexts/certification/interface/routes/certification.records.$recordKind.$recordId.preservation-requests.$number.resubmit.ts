import { createCertificationPreservationSubmissionHandlers } from "@/contexts/certification/interface/operations/create-certification-preservation-submission-handlers"
import { certificationFactory } from "@/contexts/certification/interface/request-environment/certification-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = certificationFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCertificationPreservationSubmissionHandlers("resubmit"),
)
