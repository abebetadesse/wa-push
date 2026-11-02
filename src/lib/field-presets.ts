// Ready-made sets of data fields. The pre-primary census follows the 2019 E.C. "የቅድመ አንደኛ ት/ቤት
// አጠቃላይ መረጃ መሰብሰቢያ ቅፅ" (pre-primary school general data collection form) used by school
// clusters, with its Amharic headings kept as each field's local label, plus further fields the form
// did not have (facility detail, ratios, supervision).
import type { FieldConfig } from "@/db/schema";
import type { FieldEntity, FieldType } from "@/lib/custom-fields";

export type PresetField = {
  key: string;
  label: string;
  local?: string;
  type: FieldType;
  section: string;
  options?: string[];
  config?: FieldConfig;
  help?: string;
};

export type FieldPreset = {
  id: string;
  name: string;
  description: string;
  entity: FieldEntity;
  periodic: boolean;
  fields: PresetField[];
};

const count = (key: string, label: string, local: string, section: string): PresetField => ({ key, label, local, type: "integer", section, config: { min: 0 } });
const yesNo = (key: string, label: string, local: string, section: string): PresetField => ({ key, label, local, type: "yes_no", section });
const total = (key: string, label: string, local: string, section: string, formula: string): PresetField => ({ key, label, local, type: "formula", section, config: { formula } });

const EDUCATION_LEVELS = ["Below certificate", "Certificate", "Diploma", "Degree", "Masters and above"];

export const FIELD_PRESETS: FieldPreset[] = [
  {
    id: "preprimary-census",
    name: "Pre-primary school census (cluster data collection form)",
    description: "The cluster's yearly pre-primary form: facilities, parents, teachers by sex and qualification, the school representative, students by age and sex, sections and dropouts, with totals calculated automatically.",
    entity: "school",
    periodic: true,
    fields: [
      { key: "principal_name", label: "Principal / representative name", local: "የት/ቤቱ ርዕሰ መ/ር / ተወካይ ስም", type: "text", section: "1. General" },
      { key: "principal_phone", label: "Principal / representative phone", local: "የት/ቤቱ ርዕሰ መ/ር / ተወካይ ስ.ቁ", type: "phone", section: "1. General" },
      { key: "gps_location", label: "GPS location", local: "ጅፒኤስ", type: "gps", section: "1. General", help: "Latitude, longitude — for example 9.0108, 38.7613." },
      { key: "ownership", label: "Ownership", local: "ባለቤትነት", type: "select", section: "1. General", options: ["Government", "Private", "Religious / mission", "Community", "NGO"] },

      yesNo("has_water", "Water", "ውሃ", "2. Facilities"),
      { key: "water_source", label: "Water source", local: "የውሃ ምንጭ", type: "select", section: "2. Facilities", options: ["Piped", "Protected well", "Rain harvesting", "Tanker", "None"] },
      yesNo("has_toilet", "Toilet", "መፀዳጃ ቤት", "2. Facilities"),
      count("toilets_girls", "Toilet seats for girls", "የሴት መፀዳጃ መቀመጫ", "2. Facilities"),
      count("toilets_boys", "Toilet seats for boys", "የወንድ መፀዳጃ መቀመጫ", "2. Facilities"),
      yesNo("has_handwashing", "Hand-washing station", "የእጅ መታጠቢያ", "2. Facilities"),
      yesNo("has_electricity", "Electricity", "መብራት", "2. Facilities"),
      yesNo("has_outdoor_play", "Outdoor play area", "ውጪ መጫዎቻ", "2. Facilities"),
      yesNo("has_indoor_play", "Indoor play area", "ውስጥ መጫዎቻ", "2. Facilities"),
      yesNo("has_dining", "Dining area", "መመገቢያ", "2. Facilities"),
      yesNo("has_nap_room", "Nap / sleeping room", "ማሸለቢያ/መኝታ", "2. Facilities"),
      yesNo("has_first_aid", "First-aid kit", "የመጀመሪያ እርዳታ መስጫ", "2. Facilities"),
      yesNo("has_fence", "Fenced compound", "አጥር", "2. Facilities"),
      count("classrooms_total", "Classrooms", "የመማሪያ ክፍል ብዛት", "2. Facilities"),
      { key: "classroom_condition", label: "Classroom condition", local: "የክፍሎች ሁኔታ", type: "select", section: "2. Facilities", options: ["Good", "Fair", "Poor"] },
      { key: "learning_materials", label: "Play and learning materials", local: "የመጫዎቻና መማሪያ ቁሳቁስ", type: "rating", section: "2. Facilities", config: { min: 1, max: 5 } },

      yesNo("has_feeding_program", "School feeding", "ምገባ", "3. Feeding, parents & inclusion"),
      { key: "feeding_supported_by", label: "Feeding supported by", local: "ምገባ ካለ በማን ድጋፍ", type: "text", section: "3. Feeding, parents & inclusion", help: "For example አልማ, the city administration, parents." },
      count("parents_participating", "Participating parents", "የወላጅ ተሳታፊ ብዛት", "3. Feeding, parents & inclusion"),
      count("parents_active", "Actively participating parents", "ንቁ ተሳታፈ ወላጅ ብዛት", "3. Feeding, parents & inclusion"),
      count("special_needs_students", "Students with special needs", "ልዩ ፍላጎት ተማሪ ብዛት", "3. Feeding, parents & inclusion"),
      { key: "special_needs_types", label: "Kinds of special needs", local: "የልዩ ፍላጎት አይነት", type: "checkboxes", section: "3. Feeding, parents & inclusion", options: ["Visual", "Hearing", "Physical", "Intellectual", "Autism", "Learning difficulty", "Other"] },

      count("main_teachers_female", "Main teachers — female", "ዋና መምህር — ጠቅላላ ሴት መ/ራን", "4. Teachers"),
      count("main_teachers_male", "Main teachers — male", "ዋና መምህር — ጠቅላላ ወንድ መ/ራን", "4. Teachers"),
      total("main_teachers_total", "Main teachers — total", "ዋና መምህር — ጠቅላላ መ/ራን", "4. Teachers", "main_teachers_female + main_teachers_male"),
      count("assistant_teachers_female", "Assistant teachers — female", "ረዳት መምህር — ጠቅላላ ሴት መ/ራን", "4. Teachers"),
      count("assistant_teachers_male", "Assistant teachers — male", "ረዳት መምህር — ጠቅላላ ወንድ መ/ራን", "4. Teachers"),
      total("assistant_teachers_total", "Assistant teachers — total", "ረዳት መምህር — ጠቅላላ መ/ራን", "4. Teachers", "assistant_teachers_female + assistant_teachers_male"),
      total("all_teachers_total", "Main and assistant teachers — total", "ጠቅላላ ዋና መምህር እና ረዳት መምህር", "4. Teachers", "main_teachers_total + assistant_teachers_total"),
      count("teachers_contract", "Contract teachers", "ኮንትራት መ/ራን", "4. Teachers"),
      count("teachers_permanent", "Permanent teachers", "ቋሚ መምህራን", "4. Teachers"),
      count("teachers_below_certificate", "Teachers below certificate", "ጠቅላላ ከሰርተፍኬት በታች", "4. Teachers"),
      count("teachers_certificate", "Teachers with a certificate", "ጠቅላላ ሰርተፈኬት", "4. Teachers"),
      count("teachers_diploma", "Teachers with a diploma", "ጠቅላላ ዲፕሎማ", "4. Teachers"),
      count("teachers_degree", "Teachers with a bachelor's degree", "ጠቅላላ ባችለር ድግሪ", "4. Teachers"),
      count("teachers_masters", "Teachers with a master's or above", "ጠቅላላ ማስተርስ እና በላይ", "4. Teachers"),
      count("teachers_preprimary_graduates", "Teachers graduated in pre-primary", "ጠቅላላ በቅድመ አንደኛ የተመረቁ", "4. Teachers"),
      count("teachers_age4", "Teachers for 4-year-olds", "መምህራን ብዛት — 4 አመት", "4. Teachers"),
      count("teachers_age5", "Teachers for 5-year-olds", "መምህራን ብዛት — 5 አመት", "4. Teachers"),
      count("teachers_age6", "Teachers for 6-year-olds", "መምህራን ብዛት — 6 አመት", "4. Teachers"),
      count("teachers_inservice_trained", "Teachers with in-service training", "የስራ ላይ ስልጠና", "4. Teachers"),

      count("rep_male", "School representative — male", "የት/ቤት ተወካይ — ወ", "5. School representative"),
      count("rep_female", "School representative — female", "የት/ቤት ተወካይ — ሴ", "5. School representative"),
      { key: "rep_education_level", label: "Representative's education level", local: "የትምህርት ደረጃ", type: "select", section: "5. School representative", options: EDUCATION_LEVELS },
      yesNo("rep_preprimary_graduate", "Representative graduated in pre-primary", "ተወካዩ በቅድመ አንደኛ ተመርቀዋል", "5. School representative"),
      yesNo("rep_preprimary_trained", "Representative trained in pre-primary", "በቅድመ አንደኛ ስልጠና ወስደዋል", "5. School representative"),

      count("age4_male", "4-year-olds — male", "4 አመት — ወ", "6. Students"),
      count("age4_female", "4-year-olds — female", "4 አመት — ሴ", "6. Students"),
      total("age4_total", "4-year-olds — total", "4 አመት — ድ", "6. Students", "age4_male + age4_female"),
      count("age5_male", "5-year-olds — male", "5 አመት — ወ", "6. Students"),
      count("age5_female", "5-year-olds — female", "5 አመት — ሴ", "6. Students"),
      total("age5_total", "5-year-olds — total", "5 አመት — ድ", "6. Students", "age5_male + age5_female"),
      count("age6_male", "6-year-olds — male", "6 አመት — ወ", "6. Students"),
      count("age6_female", "6-year-olds — female", "6 አመት — ሴ", "6. Students"),
      total("age6_total", "6-year-olds — total", "6 አመት — ድ", "6. Students", "age6_male + age6_female"),
      total("students_female", "Students — female total", "ጠቅላላ ሴት ተማሪዎች ብዛት", "6. Students", "age4_female + age5_female + age6_female"),
      total("students_male", "Students — male total", "ጠቅላላ ወንድ ተማሪዎች ብዛት", "6. Students", "age4_male + age5_male + age6_male"),
      total("students_total", "Students — total", "ድምር", "6. Students", "students_female + students_male"),
      count("sections_age4", "Sections for 4-year-olds", "4 አመት የክፍል ብዛት", "6. Students"),
      count("sections_age5", "Sections for 5-year-olds", "5 አመት የክፍል ብዛት", "6. Students"),
      count("sections_age6", "Sections for 6-year-olds", "6 አመት የክፍል ብዛት", "6. Students"),
      count("dropouts_female", "Dropouts — female", "ሴት አቋራጭ", "6. Students"),
      count("dropouts_male", "Dropouts — male", "ወንድ አቋራጭ", "6. Students"),
      total("dropouts_total", "Dropouts — total", "ድምር አቋራጭ", "6. Students", "dropouts_female + dropouts_male"),

      total("pupil_teacher_ratio", "Students per main teacher", "ተማሪ ለመምህር ጥምርታ", "7. Indicators", "students_total / main_teachers_total"),
      total("students_per_section", "Students per section", "ተማሪ በክፍል", "7. Indicators", "students_total / (sections_age4 + sections_age5 + sections_age6)"),
      total("girls_share", "Girls' share of students (%)", "የሴት ተማሪዎች ድርሻ (%)", "7. Indicators", "students_female * 100 / students_total"),
      total("dropout_rate", "Dropout rate (%)", "የማቋረጥ መጠን (%)", "7. Indicators", "dropouts_total * 100 / students_total"),
      total("trained_teacher_share", "Teachers trained in pre-primary (%)", "በቅድመ አንደኛ የሰለጠኑ መምህራን (%)", "7. Indicators", "teachers_preprimary_graduates * 100 / all_teachers_total"),

      { key: "last_supervision_date", label: "Last supervision visit", local: "የመጨረሻ የሱፐርቪዥን ቀን", type: "date", section: "8. Supervision" },
      { key: "supervision_score", label: "Supervision score (%)", local: "የሱፐርቪዥን ውጤት (%)", type: "percentage", section: "8. Supervision" },
      { key: "supervisor_notes", label: "Supervisor's notes", local: "የሱፐርቫይዘር አስተያየት", type: "textarea", section: "8. Supervision" },
    ],
  },
  {
    id: "student-profile",
    name: "Student profile extras",
    description: "Health, family, language, transport and inclusion details for each student, with BMI calculated from height and weight.",
    entity: "student",
    periodic: false,
    fields: [
      { key: "mother_tongue", label: "Mother tongue", local: "የአፍ መፍቻ ቋንቋ", type: "select", section: "Background", options: ["Amharic", "Afaan Oromo", "Tigrinya", "Somali", "Sidaamu Afoo", "Wolaytta", "Afar", "English", "Other"] },
      { key: "home_kebele", label: "Home kebele", local: "የመኖሪያ ቀበሌ", type: "text", section: "Background" },
      { key: "distance_km", label: "Distance to school (km)", local: "ከት/ቤት ርቀት (ኪ.ሜ)", type: "decimal", section: "Background", config: { min: 0, max: 100, unit: "km" } },
      { key: "transport", label: "How the student comes to school", local: "የትራንስፖርት አይነት", type: "radio", section: "Background", options: ["Walking", "School bus", "Public transport", "Family vehicle", "Other"] },
      { key: "guardian_name", label: "Guardian name", local: "የወላጅ/አሳዳጊ ስም", type: "text", section: "Family" },
      { key: "guardian_phone", label: "Guardian phone", local: "የወላጅ ስልክ", type: "phone", section: "Family" },
      { key: "guardian_relationship", label: "Guardian relationship", local: "ዝምድና", type: "select", section: "Family", options: ["Mother", "Father", "Grandparent", "Sibling", "Relative", "Other"] },
      { key: "guardian_occupation", label: "Guardian occupation", local: "የወላጅ ስራ", type: "text", section: "Family" },
      { key: "orphan_status", label: "Orphan status", local: "ወላጅ አልባነት", type: "select", section: "Family", options: ["Not an orphan", "Single orphan", "Double orphan"] },
      { key: "special_needs", label: "Has special needs", local: "ልዩ ፍላጎት", type: "yes_no", section: "Inclusion & health" },
      { key: "special_needs_type", label: "Kind of special need", local: "የልዩ ፍላጎት አይነት", type: "multi_select", section: "Inclusion & health", options: ["Visual", "Hearing", "Physical", "Intellectual", "Autism", "Learning difficulty", "Other"] },
      { key: "school_feeding", label: "In the school feeding program", local: "በምገባ ፕሮግራም", type: "yes_no", section: "Inclusion & health" },
      { key: "blood_group", label: "Blood group", local: "የደም አይነት", type: "select", section: "Inclusion & health", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] },
      { key: "height_cm", label: "Height (cm)", local: "ቁመት (ሴ.ሜ)", type: "decimal", section: "Inclusion & health", config: { min: 40, max: 230, unit: "cm" } },
      { key: "weight_kg", label: "Weight (kg)", local: "ክብደት (ኪ.ግ)", type: "decimal", section: "Inclusion & health", config: { min: 5, max: 200, unit: "kg" } },
      total("bmi", "Body mass index", "BMI", "Inclusion & health", "weight_kg / ((height_cm / 100) * (height_cm / 100))"),
      { key: "health_notes", label: "Health notes", local: "የጤና ማስታወሻ", type: "textarea", section: "Inclusion & health" },
    ],
  },
  {
    id: "teacher-profile",
    name: "Teacher profile extras",
    description: "Qualification, employment, training, licensing and evaluation for each teacher.",
    entity: "teacher",
    periodic: false,
    fields: [
      { key: "qualification", label: "Highest qualification", local: "የትምህርት ደረጃ", type: "select", section: "Qualification", options: EDUCATION_LEVELS },
      { key: "field_of_study", label: "Field of study", local: "የትምህርት ዘርፍ", type: "text", section: "Qualification" },
      yesNo("preprimary_graduate", "Graduated in pre-primary education", "በቅድመ አንደኛ የተመረቁ", "Qualification"),
      { key: "employment_type", label: "Employment", local: "የቅጥር አይነት", type: "radio", section: "Employment", options: ["Permanent", "Contract", "Volunteer"] },
      { key: "years_of_service", label: "Years of service", local: "የአገልግሎት ዘመን", type: "integer", section: "Employment", config: { min: 0, max: 50 } },
      { key: "teaching_age_group", label: "Age group taught", local: "የሚያስተምሩት የእድሜ ክልል", type: "checkboxes", section: "Employment", options: ["4 years", "5 years", "6 years", "Primary", "Secondary"] },
      { key: "role_in_class", label: "Role", local: "ሚና", type: "select", section: "Employment", options: ["Main teacher", "Assistant teacher", "Subject teacher", "Head teacher"] },
      { key: "inservice_hours", label: "In-service training hours this year", local: "የስራ ላይ ስልጠና ሰዓት", type: "integer", section: "Training", config: { min: 0, max: 2000 } },
      yesNo("preprimary_trained", "Trained in pre-primary", "በቅድመ አንደኛ ስልጠና ወስደዋል", "Training"),
      { key: "license_number", label: "Teaching license number", local: "የፈቃድ ቁጥር", type: "text", section: "Licensing" },
      { key: "license_expiry", label: "License expiry", local: "ፈቃድ የሚያበቃበት", type: "date", section: "Licensing" },
      { key: "performance_rating", label: "Performance rating", local: "የስራ አፈፃፀም", type: "rating", section: "Evaluation", config: { min: 1, max: 5 } },
      { key: "last_evaluation", label: "Last evaluation", local: "የመጨረሻ ግምገማ", type: "date", section: "Evaluation" },
      { key: "emergency_contact", label: "Emergency contact phone", local: "የአደጋ ጊዜ ስልክ", type: "phone", section: "Contact" },
    ],
  },
];
