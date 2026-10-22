// Subjects of the Ethiopian general-education curriculum (grades 1–12) and the grades that take
// them. Used by the demo seed to set schools up, and by the textbook catalog to tell which grade and
// subject pairs a school should have a textbook for. No server-only imports: scripts load it too.

export type CurriculumSubject = {
  name: string;
  code: string;
  department: string;
  /** First and last grade that take the subject. */
  grades: [number, number];
};

export const CURRICULUM_SUBJECTS: CurriculumSubject[] = [
  { name: "Amharic", code: "AMH", department: "Languages", grades: [1, 10] },
  { name: "Afan Oromo", code: "AFO", department: "Languages", grades: [1, 8] },
  { name: "English", code: "ENG", department: "Languages", grades: [1, 12] },
  { name: "Mathematics", code: "MATH", department: "Mathematics", grades: [1, 12] },
  { name: "Environmental Science", code: "ENV", department: "Natural Sciences", grades: [1, 6] },
  { name: "General Science", code: "GSCI", department: "Natural Sciences", grades: [7, 8] },
  { name: "Social Studies", code: "SOC", department: "Social Sciences", grades: [5, 8] },
  { name: "Citizenship Education", code: "CIT", department: "Social Sciences", grades: [1, 12] },
  { name: "Performing and Visual Arts", code: "PVA", department: "Arts", grades: [1, 8] },
  { name: "Health and Physical Education", code: "HPE", department: "Physical Education", grades: [1, 12] },
  { name: "Information Technology", code: "IT", department: "Technology", grades: [7, 12] },
  { name: "Biology", code: "BIO", department: "Natural Sciences", grades: [9, 12] },
  { name: "Chemistry", code: "CHEM", department: "Natural Sciences", grades: [9, 12] },
  { name: "Physics", code: "PHYS", department: "Natural Sciences", grades: [9, 12] },
  { name: "Geography", code: "GEO", department: "Social Sciences", grades: [9, 12] },
  { name: "History", code: "HIST", department: "Social Sciences", grades: [9, 12] },
  { name: "Economics", code: "ECON", department: "Social Sciences", grades: [9, 12] },
  { name: "Agriculture", code: "AGRI", department: "Vocational", grades: [11, 12] },
];

export function curriculumSubject(name: string) {
  const wanted = name.trim().toLowerCase();
  return CURRICULUM_SUBJECTS.find((subject) => subject.name.toLowerCase() === wanted || subject.code.toLowerCase() === wanted);
}

export function subjectTaughtInGrade(subjectName: string, grade: number) {
  const subject = curriculumSubject(subjectName);
  return subject ? grade >= subject.grades[0] && grade <= subject.grades[1] : false;
}

/** The grade number in a grade level's name ("Grade 7", "7", "Grade 11 - Natural"), if any. */
export function gradeNumber(gradeLevelName: string) {
  const match = gradeLevelName.match(/\b(1[0-2]|[1-9])\b/);
  return match ? Number(match[1]) : null;
}
