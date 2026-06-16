export const FORM_CONSTRAINTS = {
  employee: {
    codeMax: 200,
    nameMax: 200,
    emailMax: 254,
    passwordMin: 8,
    passwordMax: 200,
    deptNameMax: 200,
    positionMax: 200,
  },
  skill: {
    codeMax: 200,
    levelMin: 1,
    levelMax: 10,
    yearsMin: 0,
    noteMax: 3_000,
  },
  career: {
    sheetTextMax: 5_000,
    postingTitleMax: 500,
    deptNameMax: 200,
    requiredSkillsMax: 3_000,
    applicationMessageMax: 3_000,
  },
  goal: {
    periodMax: 100,
    titleMax: 500,
    weightMin: 1,
    weightMax: 100,
    kpiMax: 3_000,
    scoreMin: 0,
    scoreMax: 100,
    commentMax: 3_000,
  },
  oneOnOne: {
    memberEmailMax: 254,
    textMax: 5_000,
  },
  survey: {
    titleMax: 500,
    questionsMax: 100,
    answersJsonMax: 10_000,
  },
  review: {
    titleMax: 500,
    periodMax: 100,
    scoreMin: 0,
    scoreMax: 100,
    commentMax: 3_000,
  },
  businessTrip: {
    destinationMax: 500,
    purposeMax: 3_000,
    estimatedCostMin: 0,
  },
  resignation: {
    reasonMax: 3_000,
  },
  lifeEvent: {
    eventTypeMax: 200,
    detailMax: 3_000,
  },
  familyCareLeave: {
    leaveKindMax: 200,
    noteMax: 3_000,
  },
} as const

type TextOptions = {
  label: string
  max: number
  min?: number
}

export function toRequiredText(
  value: FormDataEntryValue | null,
  options: TextOptions,
): string | Error {
  if (typeof value !== "string") {
    return new Error(`${options.label}を入力してください`)
  }

  const text = value.trim()
  const min = options.min ?? 1

  if (text.length < min) {
    return new Error(
      min <= 1
        ? `${options.label}を入力してください`
        : `${options.label}は${min}文字以上で入力してください`,
    )
  }

  if (text.length > options.max) {
    return new Error(`${options.label}は${options.max}文字以内で入力してください`)
  }

  return text
}

export function toOptionalText(
  value: FormDataEntryValue | null,
  options: Omit<TextOptions, "min">,
): string | Error | null {
  if (typeof value !== "string") {
    return null
  }

  const text = value.trim()

  if (text === "") {
    return null
  }

  if (text.length > options.max) {
    return new Error(`${options.label}は${options.max}文字以内で入力してください`)
  }

  return text
}

type IntRangeOptions = {
  label: string
  min: number
  max: number
}

export function toRequiredIntInRange(
  value: FormDataEntryValue | null,
  options: IntRangeOptions,
): number | Error {
  if (typeof value !== "string" || value.trim() === "") {
    return new Error(`${options.label}を入力してください`)
  }

  return toIntInRange(value, options)
}

export function toOptionalIntInRange(
  value: FormDataEntryValue | null,
  options: IntRangeOptions,
): number | Error | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return toIntInRange(value, options)
}

function toIntInRange(value: string, options: IntRangeOptions): number | Error {
  const parsed = Number(value)

  if (Number.isSafeInteger(parsed) === false) {
    return new Error(`${options.label}は整数で入力してください`)
  }

  if (parsed < options.min || parsed > options.max) {
    return new Error(`${options.label}は${options.min}〜${options.max}の範囲で入力してください`)
  }

  return parsed
}

export function toRequiredIsoDate(value: FormDataEntryValue | null, label: string): string | Error {
  if (typeof value !== "string" || value.trim() === "") {
    return new Error(`${label}を入力してください`)
  }

  return validateIsoDate(value.trim(), label)
}

export function toOptionalIsoDate(
  value: FormDataEntryValue | null,
  label: string,
): string | Error | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return validateIsoDate(value.trim(), label)
}

function validateIsoDate(value: string, label: string): string | Error {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) === false || isRealCalendarDate(value) === false) {
    return new Error(`${label}はYYYY-MM-DD形式の実在する日付で入力してください`)
  }

  return value
}

function isRealCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function fitsJsonStringifiedLength(value: unknown, max: number): boolean {
  try {
    return JSON.stringify(value).length <= max
  } catch {
    return false
  }
}
