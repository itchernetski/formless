// Field definitions: how each profile path is recognised in the wild.
// `autocomplete` lists exact HTML autocomplete tokens (highest-confidence signal).
// `tokens` are substrings matched (word-boundary) against name/id/placeholder/label.
// Order is specific-first so "firstName" beats the generic "fullName".

export interface FieldDef {
  path: string; // dotted profile path, e.g. "identity.firstName"
  autocomplete: string[];
  tokens: string[];
}

export const FIELD_DEFS: FieldDef[] = [
  {
    path: "identity.firstName",
    autocomplete: ["given-name"],
    tokens: ["first-name", "firstname", "first_name", "fname", "given-name", "givenname"],
  },
  {
    path: "identity.lastName",
    autocomplete: ["family-name"],
    tokens: ["last-name", "lastname", "last_name", "lname", "surname", "family-name", "familyname"],
  },
  {
    path: "identity.dateOfBirth",
    autocomplete: ["bday"],
    tokens: ["birthdate", "date-of-birth", "dateofbirth", "dob", "bday", "birthday"],
  },
  {
    path: "identity.gender",
    autocomplete: ["sex"],
    tokens: ["gender", "sex"],
  },
  {
    path: "identity.nationality",
    autocomplete: [],
    tokens: ["nationality", "citizenship"],
  },
  {
    path: "contact.email",
    autocomplete: ["email"],
    tokens: ["email", "e-mail", "emailaddress"],
  },
  {
    path: "contact.phone",
    autocomplete: ["tel", "tel-national"],
    tokens: ["phone", "telephone", "mobile", "tel", "phonenumber"],
  },
  {
    path: "contact.linkedin",
    autocomplete: [],
    tokens: ["linkedin"],
  },
  {
    path: "contact.website",
    autocomplete: ["url"],
    tokens: ["website", "portfolio", "personal-url", "homepage"],
  },
  {
    path: "address.line1",
    autocomplete: ["address-line1", "street-address"],
    tokens: ["address-line1", "street-address", "streetaddress", "address1", "addr1", "street", "address"],
  },
  {
    path: "address.line2",
    autocomplete: ["address-line2"],
    tokens: ["address-line2", "address2", "addr2", "apartment", "suite", "unit"],
  },
  {
    path: "address.city",
    autocomplete: ["address-level2"],
    tokens: ["city", "town", "locality", "address-level2"],
  },
  {
    path: "address.state",
    autocomplete: ["address-level1"],
    tokens: ["state", "province", "region", "address-level1"],
  },
  {
    path: "address.postalCode",
    autocomplete: ["postal-code"],
    tokens: ["postal-code", "postalcode", "postcode", "zip", "zipcode", "zip-code"],
  },
  {
    path: "address.country",
    autocomplete: ["country-name", "country"],
    tokens: ["country-name", "country", "countryname"],
  },
  {
    path: "work.company",
    autocomplete: ["organization"],
    tokens: ["company", "employer", "organization", "organisation", "current-company"],
  },
  {
    path: "work.jobTitle",
    autocomplete: ["organization-title"],
    tokens: ["job-title", "jobtitle", "title", "position", "role", "current-title"],
  },
  {
    path: "work.yearsExperience",
    autocomplete: [],
    tokens: ["years-of-experience", "years-experience", "experience", "yoe"],
  },
  {
    path: "work.salaryExpectation",
    autocomplete: [],
    tokens: ["salary", "compensation", "expected-salary", "desired-salary"],
  },
  {
    path: "education.school",
    autocomplete: [],
    tokens: ["school", "university", "college", "institution"],
  },
  {
    path: "education.degree",
    autocomplete: [],
    tokens: ["degree", "qualification"],
  },
  {
    path: "education.fieldOfStudy",
    autocomplete: [],
    tokens: ["field-of-study", "fieldofstudy", "major", "discipline"],
  },
  {
    path: "education.graduationYear",
    autocomplete: [],
    tokens: ["graduation-year", "graduationyear", "grad-year", "gradyear"],
  },
  // Generic full-name fallback — last so specific name parts win.
  {
    path: "identity.fullName",
    autocomplete: ["name"],
    tokens: ["full-name", "fullname", "full_name", "your-name", "yourname", "name"],
  },
];
