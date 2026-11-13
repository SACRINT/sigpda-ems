import 'next-auth';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      role?: string;
      school_name?: string;
      cct?: string;
      subsystem?: string;
      profile_completed?: boolean;
      has_active_subscription?: boolean;
      is_admin?: boolean;
      is_blocked?: boolean;
      is_premium?: boolean;
      planning_count?: number;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    role?: string;
    school_name?: string;
    cct?: string;
    subsystem?: string;
    profile_completed?: boolean;
    has_active_subscription?: boolean;
    is_admin?: boolean;
    is_blocked?: boolean;
    is_premium?: boolean;
    planning_count?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    school_name?: string;
    cct?: string;
    subsystem?: string;
    profile_completed?: boolean;
    has_active_subscription?: boolean;
    is_admin?: boolean;
    is_blocked?: boolean;
    is_premium?: boolean;
    planning_count?: number;
    refreshedAt?: number;
  }
}
