import { API_COMPOSITION_PERMISSION_ENTRIES } from "@/api/http/permissions/api-composition-permission-entry.catalog"
import { SYSTEM_PERMISSION_ENTRIES } from "@/api/http/permissions/system-permission-entry.catalog"
import { SYSTEM_FEATURE_PERMISSION_ENTRIES } from "@system/domain/catalogs/iam/system-feature-permission-entry.catalog"
import { ANNOUNCEMENT_PERMISSION_ENTRIES } from "@/contexts/announcement/domain/catalogs/iam/announcement-permission-entry.catalog"
import { ANTISOCIAL_CHECK_PERMISSION_ENTRIES } from "@/contexts/antisocial-check/domain/catalogs/iam/antisocial-check-permission-entry.catalog"
import { ASSET_PERMISSION_ENTRIES } from "@/contexts/asset/domain/catalogs/iam/asset-permission-entry.catalog"
import { ATTENDANCE_PERMISSION_ENTRIES } from "@/contexts/attendance/domain/catalogs/iam/attendance-permission-entry.catalog"
import { BUSINESS_TRIP_PERMISSION_ENTRIES } from "@/contexts/business-trip/domain/catalogs/iam/business-trip-permission-entry.catalog"
import { CAREER_PERMISSION_ENTRIES } from "@/contexts/career/domain/catalogs/iam/career-permission-entry.catalog"
import { CERTIFICATE_REQUEST_PERMISSION_ENTRIES } from "@/contexts/certificate-request/domain/catalogs/iam/certificate-request-permission-entry.catalog"
import { CERTIFICATION_PERMISSION_ENTRIES } from "@/contexts/certification/domain/catalogs/iam/certification-permission-entry.catalog"
import { COMMENDATION_PERMISSION_ENTRIES } from "@/contexts/commendation/domain/catalogs/iam/commendation-permission-entry.catalog"
import { COMPANY_CALENDAR_PERMISSION_ENTRIES } from "@/contexts/company-calendar/domain/catalogs/iam/company-calendar-permission-entry.catalog"
import { COMPENSATION_CHANGE_PERMISSION_ENTRIES } from "@/contexts/compensation-change/domain/catalogs/iam/compensation-change-permission-entry.catalog"
import { DISCIPLINARY_ACTION_PERMISSION_ENTRIES } from "@/contexts/disciplinary-action/domain/catalogs/iam/disciplinary-action-permission-entry.catalog"
import { DOCUMENT_PERMISSION_ENTRIES } from "@/contexts/document/domain/catalogs/iam/document-permission-entry.catalog"
import { EXPENSE_PERMISSION_ENTRIES } from "@/contexts/expense/domain/catalogs/iam/expense-permission-entry.catalog"
import { FAMILY_CARE_LEAVE_PERMISSION_ENTRIES } from "@/contexts/family-care-leave/domain/catalogs/iam/family-care-leave-permission-entry.catalog"
import { GOVERNANCE_PERMISSION_ENTRIES } from "@/contexts/governance/domain/catalogs/iam/governance-permission-entry.catalog"
import { HEADCOUNT_PLAN_PERMISSION_ENTRIES } from "@/contexts/headcount-plan/domain/catalogs/iam/headcount-plan-permission-entry.catalog"
import { HEALTH_CHECKUP_PERMISSION_ENTRIES } from "@/contexts/health-checkup/domain/catalogs/iam/health-checkup-permission-entry.catalog"
import { IT_INCIDENT_PERMISSION_ENTRIES } from "@/contexts/it-incident/domain/catalogs/iam/it-incident-permission-entry.catalog"
import { LEAVE_PERMISSION_ENTRIES } from "@/contexts/leave/domain/catalogs/iam/leave-permission-entry.catalog"
import { LIFE_EVENT_PERMISSION_ENTRIES } from "@/contexts/life-event/domain/catalogs/iam/life-event-permission-entry.catalog"
import { MEETING_PERMISSION_ENTRIES } from "@/contexts/meeting/domain/catalogs/iam/meeting-permission-entry.catalog"
import { ONBOARDING_PERMISSION_ENTRIES } from "@/contexts/onboarding/domain/catalogs/iam/onboarding-permission-entry.catalog"
import { ONE_ON_ONE_PERMISSION_ENTRIES } from "@/contexts/one-on-one/domain/catalogs/iam/one-on-one-permission-entry.catalog"
import { PARTNER_PERMISSION_ENTRIES } from "@/contexts/partner/domain/catalogs/iam/partner-permission-entry.catalog"
import { PERFORMANCE_REVIEW_PERMISSION_ENTRIES } from "@/contexts/performance-review/domain/catalogs/iam/performance-review-permission-entry.catalog"
import { RECRUITMENT_PERMISSION_ENTRIES } from "@/contexts/recruitment/domain/catalogs/iam/recruitment-permission-entry.catalog"
import { REGULATION_PERMISSION_ENTRIES } from "@/contexts/regulation/domain/catalogs/iam/regulation-permission-entry.catalog"
import { RENTAL_PERMISSION_ENTRIES } from "@/contexts/rental/domain/catalogs/iam/rental-permission-entry.catalog"
import { RESIGNATION_PERMISSION_ENTRIES } from "@/contexts/resignation/domain/catalogs/iam/resignation-permission-entry.catalog"
import { RINGI_PERMISSION_ENTRIES } from "@/contexts/ringi/domain/catalogs/iam/ringi-permission-entry.catalog"
import { ROOM_PERMISSION_ENTRIES } from "@/contexts/room/domain/catalogs/iam/room-permission-entry.catalog"
import { SHIFT_PERMISSION_ENTRIES } from "@/contexts/shift/domain/catalogs/iam/shift-permission-entry.catalog"
import { SOFTWARE_LICENSE_PERMISSION_ENTRIES } from "@/contexts/software-license/domain/catalogs/iam/software-license-permission-entry.catalog"
import { SURVEY_PERMISSION_ENTRIES } from "@/contexts/survey/domain/catalogs/iam/survey-permission-entry.catalog"
import { THANKS_PERMISSION_ENTRIES } from "@/contexts/thanks/domain/catalogs/iam/thanks-permission-entry.catalog"
import { TRAINING_PERMISSION_ENTRIES } from "@/contexts/training/domain/catalogs/iam/training-permission-entry.catalog"
import { WORK_ACCIDENT_PERMISSION_ENTRIES } from "@/contexts/work-accident/domain/catalogs/iam/work-accident-permission-entry.catalog"
import { WORK_STYLE_PERMISSION_ENTRIES } from "@/contexts/work-style/domain/catalogs/iam/work-style-permission-entry.catalog"
import type { PermissionKey } from "@/api/http/permissions/permission-key.catalog"

type PermissionEntry = {
  key: PermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * 全permissionのカタログ。keyとカテゴリ(UIグルーピング用)の対応を、所有contextから合成する。
 * permissionは "<domain>:<action>[:<scope>]" 形式の機械可読キー。
 * 語彙と表示メタデータの正本は所有するApp contextのentry catalogで、ここは束ねるだけにする。
 * PERMISSION_KEYSとのkey集合の一致、およびsystem_iam_role_permissionsの
 * seed行がこの集合に含まれることは api/tests/contracts/permission-catalog.contract.test.ts
 * が検査する。selfスコープ(本人==操作対象)はpermissionに載せず、
 * 所有者判定としてコードの不変条件に残す
 */
export const PERMISSION_CATALOG = [
  ...SYSTEM_PERMISSION_ENTRIES,
  ...SYSTEM_FEATURE_PERMISSION_ENTRIES,
  ...API_COMPOSITION_PERMISSION_ENTRIES,
  ...ANNOUNCEMENT_PERMISSION_ENTRIES,
  ...ANTISOCIAL_CHECK_PERMISSION_ENTRIES,
  ...ASSET_PERMISSION_ENTRIES,
  ...ATTENDANCE_PERMISSION_ENTRIES,
  ...BUSINESS_TRIP_PERMISSION_ENTRIES,
  ...CAREER_PERMISSION_ENTRIES,
  ...CERTIFICATE_REQUEST_PERMISSION_ENTRIES,
  ...CERTIFICATION_PERMISSION_ENTRIES,
  ...COMMENDATION_PERMISSION_ENTRIES,
  ...COMPANY_CALENDAR_PERMISSION_ENTRIES,
  ...COMPENSATION_CHANGE_PERMISSION_ENTRIES,
  ...DISCIPLINARY_ACTION_PERMISSION_ENTRIES,
  ...DOCUMENT_PERMISSION_ENTRIES,
  ...EXPENSE_PERMISSION_ENTRIES,
  ...FAMILY_CARE_LEAVE_PERMISSION_ENTRIES,
  ...GOVERNANCE_PERMISSION_ENTRIES,
  ...HEADCOUNT_PLAN_PERMISSION_ENTRIES,
  ...HEALTH_CHECKUP_PERMISSION_ENTRIES,
  ...IT_INCIDENT_PERMISSION_ENTRIES,
  ...LEAVE_PERMISSION_ENTRIES,
  ...LIFE_EVENT_PERMISSION_ENTRIES,
  ...MEETING_PERMISSION_ENTRIES,
  ...ONBOARDING_PERMISSION_ENTRIES,
  ...ONE_ON_ONE_PERMISSION_ENTRIES,
  ...PARTNER_PERMISSION_ENTRIES,
  ...PERFORMANCE_REVIEW_PERMISSION_ENTRIES,
  ...RECRUITMENT_PERMISSION_ENTRIES,
  ...REGULATION_PERMISSION_ENTRIES,
  ...RENTAL_PERMISSION_ENTRIES,
  ...RESIGNATION_PERMISSION_ENTRIES,
  ...RINGI_PERMISSION_ENTRIES,
  ...ROOM_PERMISSION_ENTRIES,
  ...SHIFT_PERMISSION_ENTRIES,
  ...SOFTWARE_LICENSE_PERMISSION_ENTRIES,
  ...SURVEY_PERMISSION_ENTRIES,
  ...THANKS_PERMISSION_ENTRIES,
  ...TRAINING_PERMISSION_ENTRIES,
  ...WORK_ACCIDENT_PERMISSION_ENTRIES,
  ...WORK_STYLE_PERMISSION_ENTRIES,
] satisfies ReadonlyArray<PermissionEntry>
