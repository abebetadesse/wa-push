"use client";

import { createAuthClient } from "better-auth/react";
import { authBasePath } from "@/lib/base-path";

export const authClient = createAuthClient({ basePath: authBasePath });
