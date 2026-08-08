// Profile schema — the canonical shape of user data stored in the vault.
// Flat dotted paths (e.g. "identity.firstName") are what the field mapper targets.

export interface Identity {
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  gender: string;
  nationality: string;
}

export interface Contact {
  email: string;
  phone: string;
  website: string;
  linkedin: string;
}

export interface Address {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Work {
  company: string;
  jobTitle: string;
  yearsExperience: string;
  salaryExpectation: string;
}

export interface Education {
  school: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
}

export interface Profile {
  id: string;
  label: string; // "Personal", "Work", role-specific, etc.
  identity: Identity;
  contact: Contact;
  address: Address;
  work: Work;
  education: Education;
  custom: Record<string, string>;
  updatedAt: number;
}

// Section keys that hold a flat string-map (custom is handled separately).
export const SECTION_KEYS = [
  "identity",
  "contact",
  "address",
  "work",
  "education",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export function emptyProfile(id: string, label = "Personal"): Profile {
  return {
    id,
    label,
    identity: {
      firstName: "",
      lastName: "",
      fullName: "",
      dateOfBirth: "",
      gender: "",
      nationality: "",
    },
    contact: { email: "", phone: "", website: "", linkedin: "" },
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    work: { company: "", jobTitle: "", yearsExperience: "", salaryExpectation: "" },
    education: { school: "", degree: "", fieldOfStudy: "", graduationYear: "" },
    custom: {},
    updatedAt: 0,
  };
}

// Resolve a dotted path ("identity.firstName" / "custom.referral") to a value.
export function getPath(profile: Profile, path: string): string | undefined {
  if (path.startsWith("custom.")) {
    return profile.custom[path.slice("custom.".length)];
  }
  const [section, field] = path.split(".") as [SectionKey, string];
  const sec = profile[section] as unknown as Record<string, string> | undefined;
  return sec ? sec[field] : undefined;
}

// Immutably set a dotted path, returning a new Profile. Unknown section fields
// are ignored; custom.* paths are always allowed.
export function setPath(profile: Profile, path: string, value: string): Profile {
  if (path.startsWith("custom.")) {
    const key = path.slice("custom.".length);
    return { ...profile, custom: { ...profile.custom, [key]: value } };
  }
  const [section, field] = path.split(".") as [SectionKey, string];
  if (!SECTION_KEYS.includes(section)) return profile;
  const sec = profile[section] as unknown as Record<string, string>;
  if (!(field in sec)) return profile;
  return { ...profile, [section]: { ...sec, [field]: value } };
}
