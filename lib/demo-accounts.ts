import type { Role } from "@/lib/types";

export const DEMO_PASSWORD = "outreach-demo";

export interface DemoAccount {
  key: number;
  name: string;
  email: string;
  role: Role;
  /** Days from the seed date. Negative means already expired. Null never expires. */
  expiresInDays: number | null;
  canViewHistory: boolean;
  canViewContact: boolean;
  canEdit: boolean;
  /** Index into the seeded routes. Null means no route restriction. */
  routeSlot: number | null;
}

export const DEMO_USERS: DemoAccount[] = [
  {
    key: 101,
    name: "Levi Cohen",
    email: "levi.cohen@ruralchabad.example",
    role: "admin",
    expiresInDays: null,
    canViewHistory: true,
    canViewContact: true,
    canEdit: true,
    routeSlot: null,
  },
  {
    key: 102,
    name: "Miriam Adler",
    email: "miriam.adler@example.com",
    role: "visitor",
    expiresInDays: 200,
    canViewHistory: true,
    canViewContact: true,
    canEdit: false,
    routeSlot: null,
  },
  {
    key: 103,
    name: "Yosef Blum",
    email: "yosef.blum@example.com",
    role: "visitor",
    expiresInDays: 120,
    canViewHistory: true,
    canViewContact: true,
    canEdit: false,
    routeSlot: null,
  },
  {
    key: 104,
    name: "Chana Hirsch",
    email: "chana.hirsch@example.com",
    role: "visitor",
    expiresInDays: -40,
    canViewHistory: true,
    canViewContact: true,
    canEdit: false,
    routeSlot: null,
  },
  {
    key: 105,
    name: "Eli Katz",
    email: "eli.katz@example.com",
    role: "visitor",
    expiresInDays: 90,
    canViewHistory: true,
    canViewContact: true,
    canEdit: false,
    routeSlot: null,
  },
  {
    key: 106,
    name: "Rivka Stern",
    email: "rivka.stern@example.com",
    role: "limited",
    expiresInDays: 60,
    canViewHistory: false,
    canViewContact: false,
    canEdit: false,
    routeSlot: 0,
  },
  {
    key: 107,
    name: "Noah Perlman",
    email: "noah.perlman@example.com",
    role: "limited",
    expiresInDays: -15,
    canViewHistory: false,
    canViewContact: false,
    canEdit: false,
    routeSlot: 1,
  },
  {
    key: 108,
    name: "Sara Mandel",
    email: "sara.mandel@example.com",
    role: "limited",
    expiresInDays: 45,
    canViewHistory: true,
    canViewContact: true,
    canEdit: false,
    routeSlot: 2,
  },
];
