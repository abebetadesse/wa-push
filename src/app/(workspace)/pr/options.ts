// Choices and fields shared by the public relations forms and actions.

export const POST_TYPES = ["news", "announcement", "achievement", "event_recap"] as const;

/** The public profile's text fields, in page order (email and the main photo are handled apart). */
export const PROFILE_FIELDS = [
  { name: "tagline", label: "Tagline", max: 160, type: "text" },
  { name: "about", label: "About the school", max: 5000, type: "textarea" },
  { name: "mission", label: "Mission", max: 600, type: "textarea" },
  { name: "vision", label: "Vision", max: 600, type: "textarea" },
  { name: "principalName", label: "Principal's name", max: 120, type: "text" },
  { name: "principalMessage", label: "Message from the principal", max: 5000, type: "textarea" },
  { name: "address", label: "Address", max: 200, type: "text" },
  { name: "phone", label: "Phone", max: 40, type: "tel" },
] as const;
