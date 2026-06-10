CREATE UNIQUE INDEX IF NOT EXISTS idx_career_applications_posting_applicant
  ON career_applications (posting_id, applicant_id);
