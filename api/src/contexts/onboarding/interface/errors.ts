import { HTTPException } from "hono/http-exception"

export class OnboardingHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class OnboardingForbiddenError extends OnboardingHTTPException {
  constructor() {
    super(403, { message: "onboarding permission is required" })
  }
}

export class OnboardingNotFoundError extends OnboardingHTTPException {
  constructor() {
    super(404, { message: "onboarding resource is unavailable" })
  }
}

export class OnboardingUnavailableError extends OnboardingHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "onboarding service is unavailable" })
  }
}

export class OnboardingInputError extends OnboardingHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class OnboardingConflictError extends OnboardingHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "onboarding operation changed or conflicted" })
  }
}
