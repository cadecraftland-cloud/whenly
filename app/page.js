"use client"; // this page has a form and talks to the database

// ---------------------------------------------------------------------------
// page.js — the HOME page. Its only job is to create an event.
//
// When you submit the form, we insert a new row into the "events" table in
// Supabase. We give the event a friendly URL slug (e.g. "movie-night-7x2k"),
// remember on this device that you're the creator, and send you to the event's
// own page — the link you'll share with friends.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";
import {
  toDateId,
  addDays,
  buildDatesRange,
  makeSlug,
  ALL_DAY,
  isAllDay,
} from "./lib/event";

export default function Home() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [invitees, setInvitees] = useState("");
  const [startDate, setStartDate] = useState(toDateId(new Date()));
  const [endDate, setEndDate] = useState(toDateId(addDays(new Date(), 4)));
  const [slotSize, setSlotSize] = useState(60); // 1440 = whole days
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allDay = isAllDay(slotSize);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Work out the list of days from the start/end dates, and sanity-check it.
    const start = new Date(`${startDate}T00:00`);
    const end = new Date(`${endDate}T00:00`);
    if (end < start) {
      setError("The last day must be on or after the first day.");
      return;
    }
    const dates = buildDatesRange(start, end);
    if (dates.length > 31) {
      setError("Please choose a range of 31 days or fewer.");
      return;
    }

    // Turn the comma-separated invitees into a clean list of names.
    const inviteeList = invitees
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);

    const { data, error } = await supabase
      .from("events")
      .insert({
        name: name.trim() || "Untitled event",
        description: description.trim() || null,
        invitees: inviteeList,
        slug: makeSlug(name),
        dates,
        start_hour: allDay ? 0 : Number(startHour),
        end_hour: allDay ? 24 : Number(endHour),
        slot_minutes: Number(slotSize),
        closed: false,
      })
      .select()
      .single();

    if (error) {
      setError("Sorry, couldn't create the event: " + error.message);
      setSaving(false);
      return;
    }

    // Remember on THIS device that we created this event, so the event page can
    // show us the organizer controls (close / delete / lock final time).
    localStorage.setItem(`whenly-owner-${data.id}`, "1");

    router.push(`/event/${data.slug}`);
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
            <span>Description <span className="optional">(optional)</span></span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this for? Any details people should know."
              rows={2}
            />
          </label>

          <label className="field">
            <span>Who&apos;s invited? <span className="optional">(optional)</span></span>
            <input
              type="text"
              value={invitees}
              onChange={(e) => setInvitees(e.target.value)}
              placeholder="Comma-separated, e.g. Alex, Sam, Pat"
            />
            <small className="hint">
              Lets you track who&apos;s responded and who you&apos;re still waiting on.
            </small>
          </label>

          <div className="field-row">
            <label className="field">
              <span>First day</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Last day</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

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
