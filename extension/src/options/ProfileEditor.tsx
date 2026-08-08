import { useState } from "react";
import { SECTION_KEYS, type Profile, type SectionKey } from "../vault/schema";

const SECTION_LABELS: Record<SectionKey, string> = {
  identity: "Identity",
  contact: "Contact",
  address: "Address",
  work: "Work",
  education: "Education",
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  nationality: "Nationality",
  email: "Email",
  phone: "Phone",
  website: "Website",
  linkedin: "LinkedIn",
  line1: "Address line 1",
  line2: "Address line 2",
  city: "City",
  state: "State / Province",
  postalCode: "Postal code",
  country: "Country",
  company: "Company",
  jobTitle: "Job title",
  yearsExperience: "Years of experience",
  salaryExpectation: "Salary expectation",
  school: "School",
  degree: "Degree",
  fieldOfStudy: "Field of study",
  graduationYear: "Graduation year",
};

function inputType(field: string): string {
  if (field === "email") return "email";
  if (field === "phone") return "tel";
  if (field === "dateOfBirth") return "date";
  if (field === "website" || field === "linkedin") return "url";
  return "text";
}

export function ProfileEditor({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const setField = (section: SectionKey, field: string, value: string) => {
    onChange({ ...profile, [section]: { ...profile[section], [field]: value } });
  };

  const setCustom = (key: string, value: string) => {
    onChange({ ...profile, custom: { ...profile.custom, [key]: value } });
  };
  const removeCustom = (key: string) => {
    const custom = { ...profile.custom };
    delete custom[key];
    onChange({ ...profile, custom });
  };

  return (
    <div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Profile name</label>
        <input
          type="text"
          value={profile.label}
          onChange={(e) => onChange({ ...profile, label: e.target.value })}
        />
      </div>

      {SECTION_KEYS.map((section) => (
        <div className="section" key={section}>
          <h2>{SECTION_LABELS[section]}</h2>
          <div className="grid">
            {Object.keys(profile[section]).map((field) => (
              <div className="field" key={field}>
                <label>{FIELD_LABELS[field] ?? field}</label>
                <input
                  type={inputType(field)}
                  value={(profile[section] as unknown as Record<string, string>)[field]}
                  onChange={(e) => setField(section, field, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="section">
        <h2>Custom fields</h2>
        {Object.entries(profile.custom).map(([k, v]) => (
          <div className="kv" key={k} style={{ marginBottom: 8 }}>
            <input type="text" value={k} readOnly />
            <input type="text" value={v} onChange={(e) => setCustom(k, e.target.value)} />
            <button className="danger" onClick={() => removeCustom(k)}>
              ✕
            </button>
          </div>
        ))}
        <div className="kv" style={{ marginTop: 8 }}>
          <input
            type="text"
            placeholder="field name"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input
            type="text"
            placeholder="value"
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
          />
          <button
            onClick={() => {
              if (!newKey.trim()) return;
              setCustom(newKey.trim(), newVal);
              setNewKey("");
              setNewVal("");
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
