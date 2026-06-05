"use client"; // this page has a form and talks to the database

// ---------------------------------------------------------------------------
// page.js — the HOME page. Its only job is to create an event.
//
// When you submit the form, we insert a new row into the "events" table in
// Supabase. The database hands back a unique id, and we send you to that
// event's own page (/event/<id>) — the link you'll share with friends.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";
import { toDateId, buildDates, ALL_DAY, isAllDay } from "./lib/event";

export default function Home() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(toDateId(new Date()));
  const [dayCount, setDayCount] = useState(5);
  const [slotSize, setSlotSize] = useState(60); // 1440 = whole days
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allDay = isAllDay(slotSize);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const start = new Date(`${startDate}T00:00`);

    // Insert the event and ask the database to return the new row (.select())
    // so we can read its auto-generated id. .single() gives one object.
    // In whole-day mode the time-of-day range doesn't apply, so we store a
    // full 0–24 range as a harmless placeholder.
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: name.trim() || "Untitled event",
        dates: buildDates(start, Number(dayCount)),
        start_hour: allDay ? 0 : Number(startHour),
        end_hour: allDay ? 24 : Number(endHour),
        slot_minutes: Number(slotSize),
      })
      .select()
      .single();

    if (error) {
      setError("Sorry, couldn't create the event: " + error.message);
      setSaving(false);
      return;
    }

    // Go to the new event's shareable page.
    router.push(`/event/${data.id}`);
  }

  return (
    <main className="page">
      <header className="app-header">
        <h1>🗓️ Whenly</h1>
        <p className="tagline">Find the time that works for everyone.</p>
      </header>

      <section className="card">
        <h2>Create an event</h2>
        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Event name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Movie night"
            />
          </label>

          <label className="field">
            <span>First day</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Number of days</span>
            <select value={dayCount} onChange={(e) => setDayCount(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "day" : "days"}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>How precise?</span>
            <select value={slotSize} onChange={(e) => setSlotSize(Number(e.target.value))}>
              <option value={ALL_DAY}>Whole days (great for trips)</option>
              <option value={60}>1-hour time slots</option>
              <option value={30}>30-minute time slots</option>
              <option value={15}>15-minute time slots</option>
            </select>
          </label>

          {/* The time-of-day range only matters when we're using time slots. */}
          {!allDay && (
            <div className="field-row">
              <label className="field">
                <span>From</span>
                <select value={startHour} onChange={(e) => setStartHour(e.target.value)}>
                  {hourOptions()}
                </select>
              </label>
              <label className="field">
                <span>To</span>
                <select value={endHour} onChange={(e) => setEndHour(e.target.value)}>
                  {hourOptions()}
                </select>
              </label>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create event →"}
          </button>
        </form>
      </section>
    </main>
  );
}

// Build <option> tags for 0:00 .. 23:00 used by the From/To hour pickers.
function hourOptions() {
  const opts = [];
  for (let h = 0; h <= 23; h++) {
    const label = new Date(2000, 0, 1, h).toLocaleTimeString(undefined, {
      hour: "numeric",
    });
    opts.push(
      <option key={h} value={h}>
        {label}
      </option>
    );
  }
  return opts;
}
