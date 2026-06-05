"use client";

// ---------------------------------------------------------------------------
// /event/[id] — the shareable event page.
//
// "[id]" in the folder name is a URL placeholder: visiting /event/abc-123 makes
// id = "abc-123". We use that id to load the event and everyone's responses
// from Supabase. Whoever opens this link can add their availability and see the
// combined results — updating live as other people respond.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AvailabilityGrid from "../../components/AvailabilityGrid";
import { buildTimes, slotKey, formatSlot, isAllDay } from "../../lib/event";

export default function EventPage() {
  const { id } = useParams();

  const [event, setEvent] = useState(null);
  const [responses, setResponses] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound
  const [live, setLive] = useState(false);

  // The editor's name + selected cells live here in the parent so the results
  // section can load a person's existing answer into the editor ("edit mine").
  const [editName, setEditName] = useState("");
  const [editSlots, setEditSlots] = useState(new Set());

  // Re-fetch just the responses (used after saving and on live updates).
  async function refreshResponses() {
    const { data } = await supabase
      .from("responses")
      .select("name, slots")
      .eq("event_id", id);
    setResponses(data || []);
  }

  // Load the event itself once, plus the first batch of responses.
  useEffect(() => {
    async function loadEvent() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        setStatus("notfound");
        return;
      }
      setEvent(data);
      await refreshResponses();
      setStatus("ready");
    }
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Live updates, two ways that work together:
  //  1. Realtime subscription — instant pushes when a response changes (this
  //     needs realtime enabled for the table; see supabase/enable-realtime.sql).
  //  2. Polling — re-fetch every few seconds as a reliable fallback so results
  //     stay fresh even if realtime isn't enabled.
  useEffect(() => {
    const channel = supabase
      .channel(`responses-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, or DELETE
          schema: "public",
          table: "responses",
          filter: `event_id=eq.${id}`,
        },
        () => refreshResponses()
      )
      .subscribe((s) => setLive(s === "SUBSCRIBED"));

    const poll = setInterval(refreshResponses, 6000);

    // Cleanup: leave the channel and stop polling when we navigate away.
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (status === "loading") return <CenterMessage>Loading event…</CenterMessage>;
  if (status === "notfound") {
    return (
      <CenterMessage>
        Hmm, we couldn&apos;t find that event. The link may be wrong or the event
        was removed. <a href="/">Create a new one →</a>
      </CenterMessage>
    );
  }

  const allDay = isAllDay(event.slot_minutes);
  const dates = event.dates;
  const times = buildTimes(event.start_hour, event.end_hour, event.slot_minutes);

  // Load an existing person's answer into the editor so they can tweak it.
  function editPerson(person) {
    setEditName(person.name);
    setEditSlots(new Set(person.slots || []));
    document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className="page">
      <header className="app-header">
        <h1>🗓️ {event.name}</h1>
        <p className="tagline">Mark when you&apos;re free, then share the link.</p>
      </header>

      <ShareBar />

      <AddAvailability
        eventId={id}
        dates={dates}
        times={times}
        allDay={allDay}
        name={editName}
        setName={setEditName}
        selected={editSlots}
        setSelected={setEditSlots}
        existingNames={responses.map((r) => r.name)}
        onSaved={refreshResponses}
      />

      <Results
        dates={dates}
        times={times}
        allDay={allDay}
        responses={responses}
        live={live}
        onEdit={editPerson}
        onRefresh={refreshResponses}
      />
    </main>
  );
}

// Small helper to show a centered message (loading / not found).
function CenterMessage({ children }) {
  return (
    <main className="page">
      <section className="card">
        <p className="muted" style={{ marginBottom: 0 }}>{children}</p>
      </section>
    </main>
  );
}

// ===========================================================================
// The "copy this link" bar
// ===========================================================================
function ShareBar() {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard can fail on some browsers — that's ok, it's a convenience
    }
  }

  return (
    <section className="card share-bar">
      <div>
        <strong>Share this link</strong>
        <p className="muted" style={{ margin: 0 }}>
          Text it to your group. Everyone who opens it can add their times.
        </p>
      </div>
      <button className="btn btn-primary" onClick={copyLink}>
        {copied ? "Copied! ✓" : "Copy link"}
      </button>
    </section>
  );
}

// ===========================================================================
// "Add your availability" — name + paintable grid + save
// ===========================================================================
function AddAvailability({
  eventId,
  dates,
  times,
  allDay,
  name,
  setName,
  selected,
  setSelected,
  existingNames,
  onSaved,
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Prefill the name with the one this person used last time (if any).
  useEffect(() => {
    const remembered = localStorage.getItem("whenly-name");
    if (remembered && !name) setName(remembered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Is the typed name one that already responded? Then we're editing, not adding.
  const isEditing = existingNames.some(
    (n) => n.toLowerCase() === name.trim().toLowerCase()
  );

  async function handleSave() {
    setSaving(true);
    setError("");
    const cleanName = name.trim() || "Anonymous";
    localStorage.setItem("whenly-name", cleanName);

    // "upsert" = insert a new response, OR update the existing one if this
    // person (same name) already responded to this event.
    const { error } = await supabase
      .from("responses")
      .upsert(
        { event_id: eventId, name: cleanName, slots: [...selected] },
        { onConflict: "event_id,name" }
      );

    setSaving(false);
    if (error) {
      setError("Couldn't save: " + error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setSelected(new Set()); // clear the grid so the next person starts fresh
    onSaved(); // reload everyone's responses so the results update
  }

  return (
    <section className="card" id="editor">
      <h2>{isEditing ? "Edit your availability" : "Add your availability"}</h2>
      <p className="muted">
        {allDay
          ? "Type your name, then click each day that works for you."
          : "Type your name, then click and drag across the grid to mark when you're free."}
      </p>

      <label className="field">
        <span>Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex"
        />
      </label>

      {isEditing && (
        <p className="info-banner">
          ✏️ You&apos;ve responded before — saving will update your answer.
        </p>
      )}

      <AvailabilityGrid
        dates={dates}
        times={times}
        allDay={allDay}
        mode="edit"
        selected={selected}
        onChange={setSelected}
      />

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || selected.size === 0}
        >
          {saving
            ? "Saving…"
            : saved
            ? "Saved! ✓"
            : isEditing
            ? "Update my availability"
            : "Save my availability"}
        </button>
        {selected.size > 0 && (
          <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
            Clear grid
          </button>
        )}
      </div>
    </section>
  );
}

// ===========================================================================
// Combined results (heatmap + best times)
// ===========================================================================
function Results({ dates, times, allDay, responses, live, onEdit, onRefresh }) {
  // Tally how many people are free in each slot, and remember their names.
  const counts = new Map();
  const namesByKey = new Map();
  for (const person of responses) {
    for (const key of person.slots || []) {
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!namesByKey.has(key)) namesByKey.set(key, []);
      namesByKey.get(key).push(person.name);
    }
  }

  const best = bestSlots(dates, times, counts);

  return (
    <section className="card">
      <div className="results-head">
        <h2>Results</h2>
        <div className="results-actions">
          <span
            className="live-badge"
            title={
              live
                ? "Updating instantly as people respond"
                : "Auto-refreshing every few seconds"
            }
          >
            ● Live
          </span>
          <button className="btn btn-ghost btn-small" onClick={onRefresh} title="Refresh now">
            ↻
          </button>
        </div>
      </div>

      {responses.length === 0 ? (
        <p className="muted">No responses yet — be the first, or share the link above.</p>
      ) : (
        <p className="muted">
          {responses.length} {responses.length === 1 ? "person" : "people"} responded
          {" — "}tap a name to edit:
        </p>
      )}

      {responses.length > 0 && (
        <div className="chips">
          {responses.map((p) => (
            <button key={p.name} className="chip" onClick={() => onEdit(p)}>
              {p.name} ✏️
            </button>
          ))}
        </div>
      )}

      {best.length > 0 && (
        <div className="best-box">
          <h3>⭐ Best {best.length === 1 ? "time" : "times"}</h3>
          <ul>
            {best.map((b) => (
              <li key={b.key}>
                <strong>{formatSlot(b.key, allDay)}</strong> — {b.count} of{" "}
                {responses.length} free ({(namesByKey.get(b.key) || []).join(", ")})
              </li>
            ))}
          </ul>
        </div>
      )}

      <AvailabilityGrid
        dates={dates}
        times={times}
        allDay={allDay}
        mode="view"
        counts={counts}
        namesByKey={namesByKey}
        totalPeople={responses.length}
      />
      <p className="legend">Darker green = more people free. Hover a cell to see who.</p>
    </section>
  );
}

// Return every slot tied for the most people available (skips empty grids).
function bestSlots(dates, times, counts) {
  let max = 0;
  for (const value of counts.values()) max = Math.max(max, value);
  if (max === 0) return [];

  const result = [];
  for (const dateId of dates) {
    for (const minutes of times) {
      const key = slotKey(dateId, minutes);
      if ((counts.get(key) || 0) === max) result.push({ key, count: max });
    }
  }
  return result;
}
