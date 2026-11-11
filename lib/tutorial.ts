export type TutorialRole = "admin" | "shliach" | "bochur";

export type TutorialStep = {
  id: string;
  href: string;
  /** Matches [data-tour="..."]. If missing on screen, the card still explains the step. */
  target?: string;
  title: string;
  body: string;
};

export const TUTORIAL_STORAGE_KEY = "cora-tutorial-v1";

export type TutorialProgress = { step: number; done: boolean };

export function tutorialStorageKey(userId: string, role: string) {
  return `${TUTORIAL_STORAGE_KEY}:${userId}:${role}`;
}

export function loadLocalTutorial(userId: string, role: string): TutorialProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(tutorialStorageKey(userId, role));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TutorialProgress;
    if (typeof parsed.step !== "number" || typeof parsed.done !== "boolean") return null;
    return { step: Math.max(0, Math.floor(parsed.step)), done: parsed.done };
  } catch {
    return null;
  }
}

export function saveLocalTutorial(userId: string, role: string, progress: TutorialProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tutorialStorageKey(userId, role), JSON.stringify(progress));
  } catch {
    /* ignore quota */
  }
}

export function clearLocalTutorial(userId: string, role: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(tutorialStorageKey(userId, role));
  } catch {
    /* ignore */
  }
}

const HOME: TutorialStep = {
  id: "home",
  href: "/dashboard",
  target: "home",
  title: "This is Home",
  body: "Home is your starting point. It shows visit totals and the people who were visited recently, so you can see how the work is going at a glance.",
};

const HOME_FILTERS_ADMIN: TutorialStep = {
  id: "home-filters",
  href: "/dashboard",
  target: "home-filters",
  title: "Pick a project or state",
  body: "Use the project menu to look at one campaign, like Summer or Chanukah, or choose All projects to see everything together. Admins can also filter by state.",
};

const HOME_FILTERS_SHLIACH: TutorialStep = {
  id: "home-filters",
  href: "/dashboard",
  target: "home-filters",
  title: "Pick a project",
  body: "Use the project menu to look at one campaign, like Summer or Chanukah, or choose All projects to see everything together. The numbers below follow this choice.",
};

const HOME_BOCHUR: TutorialStep = {
  id: "home",
  href: "/dashboard",
  target: "home",
  title: "This is Home",
  body: "Home is your starting point. Your stats show people you visited and new people you found. The Visits box below follows the project assigned to you.",
};

const VISITS: TutorialStep = {
  id: "visits",
  href: "/dashboard",
  target: "visits",
  title: "Visits at a glance",
  body: "The first tile shows how many contacts were visited out of everyone in this view. Other tiles show new contacts found, people who were removed, and activities like Tefillin or Challah.",
};

const VISITS_LIST: TutorialStep = {
  id: "visits-people",
  href: "/dashboard",
  target: "visits-people",
  title: "The people list",
  body: "This list is newest first. It starts with people whose visit was completed. Check Include deferred if you also want to see visits that were put off. People tagged as not Jewish or not existent stay off this list.",
};

const CONTACTS: TutorialStep = {
  id: "contacts",
  href: "/households",
  target: "contacts",
  title: "Your contacts",
  body: "Everyone you visit lives here. You can filter by state or tags, switch between cards and a table, and open a person to see their history.",
};

const CONTACTS_BOCHUR: TutorialStep = {
  id: "contacts",
  href: "/households",
  target: "contacts",
  title: "Your contacts",
  body: "You see the contacts your shliach has shared with you. Open a person to read their details and log a visit when you go.",
};

const CONTACTS_ADD: TutorialStep = {
  id: "contacts-add",
  href: "/households",
  target: "contacts-add",
  title: "Add a contact",
  body: "Tap New Contact to add someone. You only need a name and place to start — for example, Alex Example at 12 Maple Street, Portland. You can add more details later.",
};

const CONTACTS_SEARCH: TutorialStep = {
  id: "contacts-search",
  href: "/households",
  target: "contacts-search",
  title: "Search the list",
  body: "Type a name, phone, or email in the search box. The list narrows as you type, so you can find someone quickly.",
};

const CONTACTS_SHARE: TutorialStep = {
  id: "contacts-share",
  href: "/households",
  target: "contacts-share",
  title: "Share with bochurim",
  body: "Each contact has a Share with bochurim checkbox. When it is on, your bochurim can see that person. When it is off, they cannot.",
};

const CONTACTS_REMOVE: TutorialStep = {
  id: "contacts-remove",
  href: "/households",
  target: "contacts-remove",
  title: "If you need to remove someone",
  body: "When you remove a contact, you pick a reason. Not Jewish or Doesn't exist tags them and takes them off the main list. Other reasons can delete the record. This tutorial never removes anyone.",
};

const CONTACTS_SUGGEST: TutorialStep = {
  id: "contacts-suggest",
  href: "/households",
  target: "contacts-suggest",
  title: "Suggest an edit",
  body: "If a name or address looks wrong, open the contact and tap Suggest edit. Your shliach reviews it. This tour will not send a real suggestion.",
};

const VISIT_LOG: TutorialStep = {
  id: "visit-log",
  href: "/households",
  target: "visit-log",
  title: "Log a visit",
  body: "Tap Visit on a contact after you go. Set the status to Completed or Deferred. Check what was done, such as Tefillin or Challah. Visited by names who went — for example, Mendy Example & Shmuel Example. It often fills in for you, and you can edit it.",
};

const MAP: TutorialStep = {
  id: "map",
  href: "/map",
  target: "map",
  title: "The map",
  body: "The map shows your contacts from above. You can turn routes on or off and plan a path for the day.",
};

const ROUTES: TutorialStep = {
  id: "routes",
  href: "/saved-routes",
  target: "routes",
  title: "Saved routes",
  body: "A route is a list of stops you can reuse. Build one from the map or from contacts, then add it to a day on the planner.",
};

const PLANNER: TutorialStep = {
  id: "planner",
  href: "/planner",
  target: "planner",
  title: "The daily planner",
  body: "Give each route a day so the week is planned. You can choose whether bochurim can see or edit a day.",
};

const PLANNER_ADMIN: TutorialStep = {
  ...PLANNER,
  body: "Give each route a day so the week is planned. In Beta, View as shliach to try the bochurim visibility and edit checkboxes without changing real data.",
};

const PLANNER_BOCHUR: TutorialStep = {
  id: "planner",
  href: "/planner",
  target: "planner",
  title: "Your daily schedule",
  body: "This is the day's plan from your shliach. Open a stop in Google or Apple Maps when you are ready to go. If a day is locked, you can look but not change it.",
};

const TEAM: TutorialStep = {
  id: "team",
  href: "/team",
  target: "team",
  title: "My Team",
  body: "Invite people, approve accounts, and see who is on the team. This is where shluchim and bochurim are managed.",
};

const TEAM_SHLIACH: TutorialStep = {
  id: "team",
  href: "/settings?tab=team",
  target: "team",
  title: "My Team",
  body: "Your team lives in Settings, on the My Team tab. Invite bochurim, approve their accounts, and assign a project.",
};

const SETTINGS_ACCOUNT: TutorialStep = {
  id: "settings-account",
  href: "/settings?tab=account",
  target: "settings-account",
  title: "Your account",
  body: "Here you can update your name, email, and password. This is your own account only.",
};

const SETTINGS_ACCOUNT_BOCHUR: TutorialStep = {
  ...SETTINGS_ACCOUNT,
  href: "/settings",
};

const SETTINGS_PHOTO: TutorialStep = {
  id: "settings-photo",
  href: "/settings?tab=account",
  target: "settings-photo",
  title: "Your photo",
  body: "Add a profile picture so your team can recognize you. You can change or remove it any time.",
};

const SETTINGS_PHOTO_BOCHUR: TutorialStep = {
  ...SETTINGS_PHOTO,
  href: "/settings",
};

const SETTINGS_THEME: TutorialStep = {
  id: "settings-theme",
  href: "/settings?tab=account",
  target: "settings-theme",
  title: "Theme and background",
  body: "Pick a theme, or upload a background photo. If you like, check Match colors to my photo and the app will follow the picture.",
};

const SETTINGS_THEME_BOCHUR: TutorialStep = {
  ...SETTINGS_THEME,
  href: "/settings",
};

const FEEDBACK: TutorialStep = {
  id: "feedback",
  href: "/dashboard",
  target: "feedback",
  title: "Send feedback",
  body: "The Feedback button lives in the top bar on every page. Use it to send a note if something is confusing or you have an idea. Admins can also read messages on Home.",
};

const FEEDBACK_NON_ADMIN: TutorialStep = {
  ...FEEDBACK,
  body: "The Feedback button lives in the top bar on every page. Use it to send a note if something is confusing or you have an idea.",
};

const BETA: TutorialStep = {
  id: "beta",
  href: "/beta",
  target: "beta",
  title: "Practice in Beta",
  body: "Beta lets you view the app as a shliach or a bochur. You can click around and try the checkboxes. A banner says practice mode, and those changes are not saved to the real database. Practice stays until you tap Reset, even if you switch views or Exit and come back.",
};

export function tutorialStepsFor(role: TutorialRole): TutorialStep[] {
  if (role === "admin") {
    return [
      HOME,
      HOME_FILTERS_ADMIN,
      VISITS,
      VISITS_LIST,
      CONTACTS,
      CONTACTS_ADD,
      CONTACTS_SEARCH,
      CONTACTS_REMOVE,
      VISIT_LOG,
      MAP,
      ROUTES,
      PLANNER_ADMIN,
      TEAM,
      SETTINGS_ACCOUNT,
      SETTINGS_PHOTO,
      SETTINGS_THEME,
      FEEDBACK,
      BETA,
    ];
  }
  if (role === "shliach") {
    return [
      HOME,
      HOME_FILTERS_SHLIACH,
      VISITS,
      VISITS_LIST,
      CONTACTS,
      CONTACTS_ADD,
      CONTACTS_SEARCH,
      CONTACTS_SHARE,
      CONTACTS_REMOVE,
      VISIT_LOG,
      MAP,
      ROUTES,
      PLANNER,
      TEAM_SHLIACH,
      SETTINGS_ACCOUNT,
      SETTINGS_PHOTO,
      SETTINGS_THEME,
      FEEDBACK_NON_ADMIN,
    ];
  }
  return [
    HOME_BOCHUR,
    VISITS,
    VISITS_LIST,
    CONTACTS_BOCHUR,
    CONTACTS_SEARCH,
    CONTACTS_SUGGEST,
    VISIT_LOG,
    MAP,
    ROUTES,
    PLANNER_BOCHUR,
    SETTINGS_ACCOUNT_BOCHUR,
    SETTINGS_PHOTO_BOCHUR,
    SETTINGS_THEME_BOCHUR,
    FEEDBACK_NON_ADMIN,
  ];
}

export function tutorialRoleFrom(role: string): TutorialRole {
  if (role === "admin" || role === "shliach" || role === "bochur") return role;
  return "bochur";
}
