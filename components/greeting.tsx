"use client";

import { useEffect, useState } from "react";
import { firstName, formatLongDate } from "@/lib/format";

export function Greeting({ name }: { name: string }) {
  const [text, setText] = useState(`Hello, ${firstName(name)}`);
  const [date, setDate] = useState("");
  useEffect(() => {
    const hour = new Date().getHours();
    const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    setText(`${hello}, ${firstName(name)}`);
    setDate(formatLongDate(new Date()));
  }, [name]);
  return (
    <div>
      <h1 className="font-heading text-[30px] font-semibold text-foreground sm:text-[34px]">{text}</h1>
      <p className="text-sm text-muted-foreground">
        {name}
        {date ? ` · ${date}` : ""}
      </p>
    </div>
  );
}
