import Form from "next/form";

/**
 * Chooses which school a page shows, as ?schoolId=… (keeping `keep` params such as the tab).
 * Renders nothing for people with one school.
 */
export function SchoolPicker({ basePath, schools, selected, keep = {} }: {
  basePath: string;
  schools: { id: string; name: string }[];
  selected: string;
  keep?: Record<string, string | undefined>;
}) {
  if (schools.length < 2) return null;
  return (
    <Form action={basePath} className="auth-form attendance-filter">
      {Object.entries(keep).map(([name, value]) => value && <input key={name} name={name} type="hidden" value={value} />)}
      <label>School
        <select defaultValue={selected} name="schoolId">
          {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
        </select>
      </label>
      <button className="secondary-button" type="submit">Show</button>
    </Form>
  );
}

/** The school a page should show: the requested one when allowed, else the first. */
export function selectedSchool(requested: string | undefined, schoolIds: string[]) {
  return schoolIds.includes(requested ?? "") ? requested! : schoolIds[0];
}
