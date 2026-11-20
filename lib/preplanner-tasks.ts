export interface PreplannerTask {
  id: string;
  state: string;
  task: string;
  phone: string;
  email: string;
  holding: string;
  nextFollowUp: string | null;
  done: boolean;
  createdAt: string;
}

export interface PreplannerTaskInput {
  id?: string;
  state: string;
  task: string;
  phone: string;
  email: string;
  holding: string;
  nextFollowUp: string | null;
  done?: boolean;
}

/** Open tasks by next follow-up (no date last), then done tasks. */
export function sortTasks(tasks: PreplannerTask[]): PreplannerTask[] {
  return tasks.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.nextFollowUp ?? "9999-99-99";
    const bd = b.nextFollowUp ?? "9999-99-99";
    return ad.localeCompare(bd) || a.createdAt.localeCompare(b.createdAt);
  });
}

export function isOverdue(task: PreplannerTask, today: string): boolean {
  return !task.done && Boolean(task.nextFollowUp) && (task.nextFollowUp as string) < today;
}

/** Digits (and a leading +) only, for a tel: link. */
export function telHref(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}
