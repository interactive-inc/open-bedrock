import { Suspense } from "react"
import { CourseList } from "@/app/(app)/training/_components/course-list"
import { CreateCourseForm } from "@/app/(app)/training/_components/create-course-form"
import { MyEnrollmentList } from "@/app/(app)/training/_components/my-enrollment-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { getMyTrainingEnrollments } from "@/lib/api/get-my-training-enrollments"
import { getTrainingCourses } from "@/lib/api/get-training-courses"
import { canManageTraining } from "@/lib/training/can-manage-training"

// 研修画面。研修コース一覧と自分の受講一覧を RSC で取得して表示する。
// 特権ロールにはコース作成フォームを追加で表示する。
export default async function TrainingPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageTraining(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">研修</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">コース一覧</h2>

        <Suspense fallback={<TrainingSkeleton />}>
          <Courses />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の受講</h2>

        <Suspense fallback={<TrainingSkeleton />}>
          <MyEnrollments />
        </Suspense>
      </section>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>コースを作成</CardTitle>
          </CardHeader>

          <CardContent>
            <CreateCourseForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// GET /training/courses を取得してコース一覧を描画する非同期 RSC。
// 受講済みコードの判定のため自分の受講一覧も併せて取得する。
async function Courses() {
  const courses = await getTrainingCourses()

  if (courses instanceof Error) {
    return <p className="text-sm text-destructive">研修コースの取得に失敗しました</p>
  }

  const enrollments = await getMyTrainingEnrollments()

  const enrolledCourseIds =
    enrollments instanceof Error ? [] : enrollments.map((enrollment) => enrollment.course_id)

  return <CourseList courses={courses} enrolledCourseIds={enrolledCourseIds} />
}

// GET /training/enrollments/me を取得して自分の受講一覧を描画する非同期 RSC。
// コース名表示のため courses も併せて取得する。
async function MyEnrollments() {
  const enrollments = await getMyTrainingEnrollments()

  if (enrollments instanceof Error) {
    return <p className="text-sm text-destructive">受講一覧の取得に失敗しました</p>
  }

  const courses = await getTrainingCourses()

  const courseList = courses instanceof Error ? [] : courses

  return <MyEnrollmentList enrollments={enrollments} courses={courseList} />
}

function TrainingSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
