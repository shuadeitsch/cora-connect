import { HDate, HebrewCalendar, flags } from "@hebcal/core";

/** Chabad dates hebcal doesn't list, keyed "Month-day" with hebcal's month names. */
const CHABAD: Record<string, string> = {
  "Kislev-10": "Yud Kislev",
  "Kislev-19": "Yud Tes Kislev",
  "Kislev-20": "Chof Kislev",
  "Tevet-5": "Hei Teves",
  "Tevet-24": "Chof Daled Teves",
  "Sh'vat-10": "Yud Shvat",
  "Nisan-11": "Yud Alef Nissan",
  "Tamuz-3": "Gimmel Tammuz",
  "Tamuz-12": "Yud Beis Tammuz",
  "Tamuz-13": "Yud Gimmel Tammuz",
  "Av-20": "Chof Av",
  "Elul-18": "Chai Elul",
};

const SPELLING: [RegExp, string][] = [
  [/Tevet/g, "Teves"], [/Sh'vat/g, "Shvat"], [/Tamuz/g, "Tammuz"], [/Nisan/g, "Nissan"], [/Iyyar/g, "Iyar"],
  [/Rosh Hashana\b/g, "Rosh Hashanah"], [/Sukkot/g, "Sukkos"], [/Shmini Atzeret/g, "Shemini Atzeres"],
  [/Simchat Torah/g, "Simchas Torah"], [/Shavuot/g, "Shavuos"], [/Ta'anit Esther/g, "Taanis Esther"],
  [/Ta'anit Bechorot/g, "Taanis Bechoros"], [/Tish'a B'Av/g, "Tisha B'Av"], [/Asara B'Tevet/g, "Asarah B'Teves"],
  [/Tzom Gedaliah/g, "Tzom Gedalyah"], [/Tzom Tammuz/g, "Shiva Asar B'Tammuz"], [/Tu BiShvat/g, "Tu B'Shvat"],
  [/Lag BaOmer/g, "Lag B'Omer"], [/Pesach Sheni/g, "Pesach Sheini"], [/ \d{4}$/g, ""],
];

const SKIP = flags.MODERN_HOLIDAY | flags.SHABBAT_MEVARCHIM | flags.MOLAD | flags.OMER_COUNT | flags.DAF_YOMI;
const SKIP_NAMES = new Set(["Chag HaBanot", "Leil Selichot", "Yom Kippur Katan", "Purim Meshulash"]);

function ord(n: number) {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}

function chabad(text: string) {
  return SPELLING.reduce((value, [pattern, next]) => value.replace(pattern, next), text);
}

function noon(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

/**
 * Jewish-calendar labels for a planner day (diaspora rules), in Chabad wording.
 * Holidays that begin that evening are shown on that day ("First night of Chanukah", "Erev Yud Tes Kislev").
 */
export function holidayLabels(date: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const day = noon(date);
  const hd = new HDate(day);
  const labels: string[] = [];
  if (day.getDay() === 6) labels.push("Shabbos");
  for (const event of HebrewCalendar.getHolidaysOnDate(hd, false) ?? []) {
    const mask = event.getFlags();
    if (mask & SKIP) continue;
    const desc = event.getDesc();
    if (SKIP_NAMES.has(desc)) continue;
    const candles = desc.match(/^Chanukah: (\d) Candles?$/);
    if (candles) {
      const night = Number(candles[1]);
      labels.push(night === 1 ? "First night of Chanukah" : `${ord(night - 1)} day of Chanukah · ${ord(night)} night`);
      continue;
    }
    if (desc === "Chanukah: 8th Day") { labels.push("8th day of Chanukah"); continue; }
    labels.push(chabad(desc));
  }
  const today = CHABAD[`${hd.getMonthName()}-${hd.getDate()}`];
  if (today) labels.push(today);
  const next = hd.next();
  const tonight = CHABAD[`${next.getMonthName()}-${next.getDate()}`];
  if (tonight) labels.push(`Erev ${tonight}`);
  return [...new Set(labels)];
}
