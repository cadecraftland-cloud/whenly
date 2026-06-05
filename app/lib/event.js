// ---------------------------------------------------------------------------
// event.js — pure helper functions (no React, no UI).
//
// "Pure" means each function just takes inputs and returns outputs with no side
// effects. That makes them easy to read, reuse, and reason about. These helpers
// turn an event's settings (which days, what hours) into the concrete list of
// time slots the grid is built from, and format dates/times for display.
// ---------------------------------------------------------------------------

// The shape of an "event" we coordinate. Example:
// {
//   name: "Movie night",
//   dates: ["2026-06-08", "2026-06-09"],   // the days people can pick from
//   startHour: 17,                          // grid starts at 5:00 PM
//   endHour: 22,                            // grid ends at 10:00 PM
//   slotMinutes: 60,                        // each row is a 60-minute block
// }

// Format a JS Date as "YYYY-MM-DD" (e.g. "2026-06-08"). We use this string as a
// stable id for a day. (We avoid toISOString() because that converts to UTC and
// can shift the date across midnight depending on the timezone.)
export function toDateId(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // months are 0-based
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Return a new Date that is `count` days after the given date.
export function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

// Build a list of day-ids starting at `startDate`, for `count` days in a row.
// e.g. buildDates(today, 3) -> ["2026-06-08", "2026-06-09", "2026-06-10"]
export function buildDates(startDate, count) {
  const dates = [];
  for (let i = 0; i < count; i++) {
    dates.push(toDateId(addDays(startDate, i)));
  }
  return dates;
}

// Whole-day events use this special slot size. We treat any slot size of a full
// day (1440 minutes) or more as "whole days" mode — one cell per day, no times.
export const ALL_DAY = 1440;

export function isAllDay(slotMinutes) {
  return Number(slotMinutes) >= ALL_DAY;
}

// Build the list of time rows for the grid. Each entry is the number of minutes
// since midnight, e.g. 17:00 -> 1020. With startHour 17, endHour 19, slot 60
// you get [1020, 1080] (5 PM and 6 PM). The endHour itself is not included as a
// row because a row represents the block *starting* at that time.
//
// In whole-day mode there are no time rows, so we return a single placeholder
// slot (0) that represents "the whole day".
export function buildTimes(startHour, endHour, slotMinutes) {
  if (isAllDay(slotMinutes)) return [0];
  const times = [];
  for (let m = startHour * 60; m < endHour * 60; m += slotMinutes) {
    times.push(m);
  }
  return times;
}

// A "slot" is one cell in the grid: a specific day + a specific time.
// We give each slot a unique string key so we can store which slots a person
// picked in a simple list/set. e.g. "2026-06-08|1020"
export function slotKey(dateId, minutes) {
  return `${dateId}|${minutes}`;
}

// --- Formatting helpers (turn raw data into human-friendly text) -------------

// "2026-06-08" -> "Mon Jun 8"
export function formatDateHeader(dateId) {
  // Append T00:00 so it's parsed in local time, not UTC.
  const date = new Date(`${dateId}T00:00`);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${month} ${date.getDate()}`;
}

// 1020 -> "5:00 PM"
export function formatTime(minutes) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "2026-06-08|1020" -> "Mon Jun 8, 5:00 PM" (used in the results list).
// In whole-day mode we just show the date, since there's no specific time.
export function formatSlot(key, allDay = false) {
  const [dateId, minutes] = key.split("|");
  if (allDay) return formatDateHeader(dateId);
  return `${formatDateHeader(dateId)}, ${formatTime(Number(minutes))}`;
}
