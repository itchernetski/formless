// Human-readable labels for dotted profile paths. Used by import/capture review
// UIs (Phase 3 / 3.5) so the same path resolves to the same label everywhere.

const FIELD_LABELS: Record<string, string> = {
  "identity.firstName": "First name",
  "identity.lastName": "Last name",
  "identity.fullName": "Full name",
  "identity.dateOfBirth": "Date of birth",
  "identity.gender": "Gender",
  "identity.nationality": "Nationality",
  "contact.email": "Email",
  "contact.phone": "Phone",
  "contact.website": "Website",
  "contact.linkedin": "LinkedIn",
  "address.line1": "Address line 1",
  "address.line2": "Address line 2",
  "address.city": "City",
  "address.state": "State / Province",
  "address.postalCode": "Postal code",
  "address.country": "Country",
  "work.company": "Company",
  "work.jobTitle": "Job title",
  "work.yearsExperience": "Years of experience",
  "work.salaryExpectation": "Salary expectation",
  "education.school": "School",
  "education.degree": "Degree",
  "education.fieldOfStudy": "Field of study",
  "education.graduationYear": "Graduation year",
};

export function pathLabel(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  if (path.startsWith("custom.")) return path.slice("custom.".length);
  return path;
}
