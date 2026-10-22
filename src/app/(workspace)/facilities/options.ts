// Shared by the Laboratories (/lab) and Workshops (/workshop) pages, which differ only in these.

export const FACILITY_KINDS = ["lab", "workshop"] as const;
export type FacilityKind = (typeof FACILITY_KINDS)[number];

export const FACILITY_COPY: Record<FacilityKind, { path: string; title: string; one: string; description: string; roles: readonly ["school_admin", "lab_technician" | "workshop_manager"] }> = {
  lab: {
    path: "/lab",
    title: "Laboratories",
    one: "laboratory",
    description: "Science laboratories: equipment and chemical stock, class bookings, and safety incidents.",
    roles: ["school_admin", "lab_technician"],
  },
  workshop: {
    path: "/workshop",
    title: "Workshops",
    one: "workshop",
    description: "Technical and vocational workshops: tools and materials, practical sessions, and maintenance.",
    roles: ["school_admin", "workshop_manager"],
  },
};

export const ITEM_CATEGORIES = ["equipment", "chemical", "consumable", "tool", "safety"] as const;
export const ITEM_CONDITIONS = ["good", "needs_repair", "out_of_service"] as const;
export const LOG_TYPES = ["incident", "maintenance"] as const;
export const SEVERITIES = ["low", "medium", "high"] as const;
