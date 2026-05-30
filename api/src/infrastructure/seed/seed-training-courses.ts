type SeedTrainingCourse = {
  id: number
  code: string
  title: string
  description: string | null
  durationMinutes: number | null
  category: string
  isRequired: boolean
  status: "active" | "archived"
}

export const seedTrainingCourses: ReadonlyArray<SeedTrainingCourse> = [
  {
    id: 1,
    code: "TR-SEC-01",
    title: "Information Security Basics",
    description: "Mandatory security training for all employees",
    durationMinutes: 60,
    category: "compliance",
    isRequired: true,
    status: "active",
  },
  {
    id: 2,
    code: "TR-MGR-01",
    title: "New Manager Training",
    description: null,
    durationMinutes: 180,
    category: "management",
    isRequired: false,
    status: "active",
  },
  {
    id: 3,
    code: "TR-OLD-01",
    title: "Legacy System Operations",
    description: null,
    durationMinutes: null,
    category: "system",
    isRequired: false,
    status: "archived",
  },
]
