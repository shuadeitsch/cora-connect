"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageSquareText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { sendFeedbackAction } from "@/lib/feedback-actions";

/** Top-bar Feedback: type a message and Send. No phone number. */
export function FeedbackButton({ preview = false }: { preview?: boolean }) {
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function send() {
    setError("");
    if (preview) {
      toast({ title: "Preview only", tone: "error" });
      return;
    }
    start(async () => {
      const result = await sendFeedbackAction(message, pathname);
      if (!result.ok) {
        if (result.error === "Preview only") toast({ title: "Preview only", tone: "error" });
        else setError(result.error);
        return;
      }
      setMessage("");
      setOpen(false);
      toast({ title: "Feedback sent", tone: "ok" });
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Feedback" data-tour="feedback"
          title="Feedback"
          className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <MessageSquareText className="size-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] space-y-3">
        <p className="font-heading text-sm font-semibold text-foreground">Send feedback</p>
        <p className="text-xs text-muted-foreground">Tell us what works, what is confusing, or what you want next.</p>
        <Textarea
          aria-label="Your feedback"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type your feedback…"
          className="min-h-24"
          disabled={pending}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="button" className="min-h-11 w-full rounded-full" disabled={pending || !message.trim()} onClick={send}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
