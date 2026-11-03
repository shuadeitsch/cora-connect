"use client";

import { useRouter } from "next/navigation";
import { undoAction } from "@/lib/actions";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/types";

export function useUndoToast() {
  const toast = useToast();
  const router = useRouter();

  return function announce(result: ActionResult<unknown>, title: string, afterUndo?: () => void) {
    if (!result.ok) {
      toast({ title: result.error, tone: "error" });
      return false;
    }
    const payload = result.undo;
    toast({
      title: result.warning ? `${title}. ${result.warning}` : title,
      undo: payload
        ? async () => {
            const undone = await undoAction(payload);
            if (!undone.ok) toast({ title: undone.error, tone: "error" });
            else {
              afterUndo?.();
              toast({ title: "Undone" });
            }
            router.refresh();
          }
        : undefined,
    });
    router.refresh();
    return true;
  };
}
