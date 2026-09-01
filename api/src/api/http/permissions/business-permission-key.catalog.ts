import { ANNOUNCEMENT_PERMISSION_KEYS } from "@/contexts/announcement/domain/catalogs/iam/announcement-permission-key.catalog"
import { ANTISOCIAL_CHECK_PERMISSION_KEYS } from "@/contexts/antisocial-check/domain/catalogs/iam/antisocial-check-permission-key.catalog"
import { ASSET_PERMISSION_KEYS } from "@/contexts/asset/domain/catalogs/iam/asset-permission-key.catalog"
import { ATTENDANCE_PERMISSION_KEYS } from "@/contexts/attendance/domain/catalogs/iam/attendance-permission-key.catalog"
import { BUSINESS_TRIP_PERMISSION_KEYS } from "@/contexts/business-trip/domain/catalogs/iam/business-trip-permission-key.catalog"
import { CAREER_PERMISSION_KEYS } from "@/contexts/career/domain/catalogs/iam/career-permission-key.catalog"
import { CERTIFICATE_REQUEST_PERMISSION_KEYS } from "@/contexts/certificate-request/domain/catalogs/iam/certificate-request-permission-key.catalog"
import { CERTIFICATION_PERMISSION_KEYS } from "@/contexts/certification/domain/catalogs/iam/certification-permission-key.catalog"
import { COMMENDATION_PERMISSION_KEYS } from "@/contexts/commendation/domain/catalogs/iam/commendation-permission-key.catalog"
import { COMPANY_CALENDAR_PERMISSION_KEYS } from "@/contexts/company-calendar/domain/catalogs/iam/company-calendar-permission-key.catalog"
import { COMPENSATION_CHANGE_PERMISSION_KEYS } from "@/contexts/compensation-change/domain/catalogs/iam/compensation-change-permission-key.catalog"
import { DISCIPLINARY_ACTION_PERMISSION_KEYS } from "@/contexts/disciplinary-action/domain/catalogs/iam/disciplinary-action-permission-key.catalog"
import { DOCUMENT_PERMISSION_KEYS } from "@/contexts/document/domain/catalogs/iam/document-permission-key.catalog"
import { EXPENSE_PERMISSION_KEYS } from "@/contexts/expense/domain/catalogs/iam/expense-permission-key.catalog"
import { FAMILY_CARE_LEAVE_PERMISSION_KEYS } from "@/contexts/family-care-leave/domain/catalogs/iam/family-care-leave-permission-key.catalog"
import { GOVERNANCE_PERMISSION_KEYS } from "@/contexts/governance/domain/catalogs/iam/governance-permission-key.catalog"
import { HEADCOUNT_PLAN_PERMISSION_KEYS } from "@/contexts/headcount-plan/domain/catalogs/iam/headcount-plan-permission-key.catalog"
import { HEALTH_CHECKUP_PERMISSION_KEYS } from "@/contexts/health-checkup/domain/catalogs/iam/health-checkup-permission-key.catalog"
import { IT_INCIDENT_PERMISSION_KEYS } from "@/contexts/it-incident/domain/catalogs/iam/it-incident-permission-key.catalog"
import { LEAVE_PERMISSION_KEYS } from "@/contexts/leave/domain/catalogs/iam/leave-permission-key.catalog"
import { LIFE_EVENT_PERMISSION_KEYS } from "@/contexts/life-event/domain/catalogs/iam/life-event-permission-key.catalog"
import { MEETING_PERMISSION_KEYS } from "@/contexts/meeting/domain/catalogs/iam/meeting-permission-key.catalog"
import { ONBOARDING_PERMISSION_KEYS } from "@/contexts/onboarding/domain/catalogs/iam/onboarding-permission-key.catalog"
import { ONE_ON_ONE_PERMISSION_KEYS } from "@/contexts/one-on-one/domain/catalogs/iam/one-on-one-permission-key.catalog"
import { PARTNER_PERMISSION_KEYS } from "@/contexts/partner/domain/catalogs/iam/partner-permission-key.catalog"
import { PERFORMANCE_REVIEW_PERMISSION_KEYS } from "@/contexts/performance-review/domain/catalogs/iam/performance-review-permission-key.catalog"
import { RECRUITMENT_PERMISSION_KEYS } from "@/contexts/recruitment/domain/catalogs/iam/recruitment-permission-key.catalog"
import { REGULATION_PERMISSION_KEYS } from "@/contexts/regulation/domain/catalogs/iam/regulation-permission-key.catalog"
import { RENTAL_PERMISSION_KEYS } from "@/contexts/rental/domain/catalogs/iam/rental-permission-key.catalog"
import { RESIGNATION_PERMISSION_KEYS } from "@/contexts/resignation/domain/catalogs/iam/resignation-permission-key.catalog"
import { RINGI_PERMISSION_KEYS } from "@/contexts/ringi/domain/catalogs/iam/ringi-permission-key.catalog"
import { ROOM_PERMISSION_KEYS } from "@/contexts/room/domain/catalogs/iam/room-permission-key.catalog"
import { SHIFT_PERMISSION_KEYS } from "@/contexts/shift/domain/catalogs/iam/shift-permission-key.catalog"
import { SOFTWARE_LICENSE_PERMISSION_KEYS } from "@/contexts/software-license/domain/catalogs/iam/software-license-permission-key.catalog"
import { SURVEY_PERMISSION_KEYS } from "@/contexts/survey/domain/catalogs/iam/survey-permission-key.catalog"
import { THANKS_PERMISSION_KEYS } from "@/contexts/thanks/domain/catalogs/iam/thanks-permission-key.catalog"
import { TRAINING_PERMISSION_KEYS } from "@/contexts/training/domain/catalogs/iam/training-permission-key.catalog"
import { WORK_ACCIDENT_PERMISSION_KEYS } from "@/contexts/work-accident/domain/catalogs/iam/work-accident-permission-key.catalog"
import { WORK_STYLE_PERMISSION_KEYS } from "@/contexts/work-style/domain/catalogs/iam/work-style-permission-key.catalog"

/**
 * 業務Appが所有し、Company roleへ割り当て可能な権限key。
 * 語彙の正本は各App contextのcatalogで、ここは束ねるだけにする。
 * Appのディレクトリを消せばその権限keyも一緒に消える。
 */
export const BUSINESS_PERMISSION_KEYS = [
  ...ANNOUNCEMENT_PERMISSION_KEYS,
  ...ANTISOCIAL_CHECK_PERMISSION_KEYS,
  ...ASSET_PERMISSION_KEYS,
  ...ATTENDANCE_PERMISSION_KEYS,
  ...BUSINESS_TRIP_PERMISSION_KEYS,
  ...CAREER_PERMISSION_KEYS,
  ...CERTIFICATE_REQUEST_PERMISSION_KEYS,
  ...CERTIFICATION_PERMISSION_KEYS,
  ...COMMENDATION_PERMISSION_KEYS,
  ...COMPANY_CALENDAR_PERMISSION_KEYS,
  ...COMPENSATION_CHANGE_PERMISSION_KEYS,
  ...DISCIPLINARY_ACTION_PERMISSION_KEYS,
  ...DOCUMENT_PERMISSION_KEYS,
  ...EXPENSE_PERMISSION_KEYS,
  ...FAMILY_CARE_LEAVE_PERMISSION_KEYS,
  ...GOVERNANCE_PERMISSION_KEYS,
  ...HEADCOUNT_PLAN_PERMISSION_KEYS,
  ...HEALTH_CHECKUP_PERMISSION_KEYS,
  ...IT_INCIDENT_PERMISSION_KEYS,
  ...LEAVE_PERMISSION_KEYS,
  ...LIFE_EVENT_PERMISSION_KEYS,
  ...MEETING_PERMISSION_KEYS,
  ...ONBOARDING_PERMISSION_KEYS,
  ...ONE_ON_ONE_PERMISSION_KEYS,
  ...PARTNER_PERMISSION_KEYS,
  ...PERFORMANCE_REVIEW_PERMISSION_KEYS,
  ...RECRUITMENT_PERMISSION_KEYS,
  ...REGULATION_PERMISSION_KEYS,
  ...RENTAL_PERMISSION_KEYS,
  ...RESIGNATION_PERMISSION_KEYS,
  ...RINGI_PERMISSION_KEYS,
  ...ROOM_PERMISSION_KEYS,
  ...SHIFT_PERMISSION_KEYS,
  ...SOFTWARE_LICENSE_PERMISSION_KEYS,
  ...SURVEY_PERMISSION_KEYS,
  ...THANKS_PERMISSION_KEYS,
  ...TRAINING_PERMISSION_KEYS,
  ...WORK_ACCIDENT_PERMISSION_KEYS,
  ...WORK_STYLE_PERMISSION_KEYS,
] as const
