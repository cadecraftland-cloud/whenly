"use client";

// ---------------------------------------------------------------------------
// /event/[id] — the shareable event page.
//
// "[id]" in the folder name is a URL placeholder. It's normally a friendly slug
// like "movie-night-7x2k" (older events used a long UUID — we handle both).
// Whoever opens this link can add their availability and see the combined
// results, updating live. The event's creator additionally sees organizer
// controls (lock a final time, close, delete).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AvailabilityGrid from "../../components/AvailabilityGrid";
import { buildTimes, slotKey, formatSlot, isAllDay, isUuid } from "../../lib/event";

export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();

  const [event, setEvent] = useState(null);
  const [responses, setResponses] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound
  const [live, setLive] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // The editor's name + selected cells live here in the parent so the results
  // section can load a person's existing answer into the editor ("edit mine").
  const [editName, setEditName] = useState("");
  const [editSlots, setEditSlots] = useState(new Set());

  const param = decodeURIComponent(id);

  // Re-fetch just the responses (used after saving and on live updates).
  async function refreshResponses(eventId) {
    const { data } = await supabase
      .from("responses")
      .select("name, slots")
      .eq("event_id", eventId);
    setResponses(data || []);
  }

  // Load the event itself once (by slug, falling back to id), plus responses.
  useEffect(() => {
    async function loadEvent() {
      let { data } = await supabase
        .from("events")
        .select("*")
        .eq("slug", param)
        .maybeSingle();

      if (!data && isUuid(param)) {
        ({ data } = await supabase
          .from("events")
          .select("*")
          .eq("id", param)
          .maybeSingle());
      }

      if (!data) {
        setStatus("notfound");
        return;
      }
      setEvent(data);
      setIsOwner(localStorage.getItem(`whenly-owner-${data.id}`) === "1");
      await refreshResponses(data.id);
      setStatus("ready");
    }
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  // Live updates: realtime subscription (instant) + polling (reliable fallback).
  useEffect(() => {
    if (!event?.id) return;
    const channel = supabase
      .channel(`responses-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "responses",
          filter: `event_id=eq.${event.id}`,
        },
        () => refreshResponses(event.id)
      )
      .subscribe((s) => setLive(s === "SUBSCRIBED"));

    const poll = setInterval(() => refreshResponses(event.id), 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [event?.id]);

  if (status === "loading") return <CenterMessage>Loading event…</CenterMessage>;
  if (status === "notfound") {
    return (
      <CenterMessage>
        Hmm, we couldn&apos;t find that event. The link may be wrong or the event
        was deleted. <a href="/">Create a new one →</a>
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

  // --- Organizer actions (only reachable if isOwner) ----------------------
  async function setFinalSlot(key) {
    await supabase.from("events").update({ final_slot: key }).eq("id", event.id);
    setEvent({ ...event, final_slot: key });
  }
  async function toggleClosed() {
    const next = !event.closed;
    await supabase.from("events").update({ closed: next }).eq("id", event.id);
    setEvent({ ...event, closed: next });
  }
  async function deleteEvent() {
    if (!window.confirm("Delete this event for everyone? This cannot be undone.")) return;
    await supabase.from("events").delete().eq("id", event.id);
    localStorage.removeItem(`whenly-owner-${event.id}`);
    router.push("/");
  }

  return (
    <main className="page">
      <header className="app-header">
        <h1>🗓️ {event.name}</h1>
        {event.description && <p className="tagline">{event.description}</p>}
      </header>

      {event.final_slot && (
        <section className="card final-banner">
          <div>
            <strong>✅ Final time</strong>
            <p style={{ margin: 0 }}>{formatSlot(event.final_slot, allDay)}</p>
          </div>
          {isOwner && (
            <button className="btn btn-ghost" onClick={() => setFinalSlot(null)}>
              Unlock
            </button>
          )}
        </section>
      )}

      <ShareBar />

      {event.closed ? (
        <section className="card">
          <p className="info-banner" style={{ margin: 0 }}>
            🔒 This event is closed to new responses.
          </p>
        </section>
      ) : (
        <AddAvailability
          eventId={event.id}
          dates={dates}
          times={times}
          allDay={allDay}
          name={editName}
          setName={setEditName}
          selected={editSlots}
          setSelected={setEditSlots}
          existingNames={responses.map((r) => r.name)}
          onSaved={() => refreshResponses(event.id)}
        />
      )}

      <Results
        dates={dates}
        times={times}
        allDay={allDay}
        responses={responses}
        invitees={event.invitees || []}
        finalSlot={event.final_slot}
        isOwner={isOwner}
        live={live}
        onEdit={editPerson}
        onLock={setFinalSlot}
        onRefresh={() => refreshResponses(event.id)}
      />

      {isOwner && (
        <OrganizerControls
          closed={event.closed}
          onToggleClosed={toggleClosed}
          onDelete={deleteEvent}
        />
      )}
    </main>
  );
}

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

  useEffect(() => {
    const remembered = localStorage.getItem("whenly-name");
    if (remembered && !name) setName(remembered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEditing = existingNames.some(
    (n) => n.toLowerCase() === name.trim().toLowerCase()
  );

  async function handleSave() {
    setSaving(true);
    setError("");
    const cleanName = name.trim() || "Anonymous";
    localStorage.setItem("whenly-name", cleanName);

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
    setSelected(new Set());
    onSaved();
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
// Combined results (responded/missing + best times + heatmap)
// ===========================================================================
function Results({
  dates,
  times,
  allDay,
  responses,
  invitees,
  finalSlot,
  isOwner,
  live,
  onEdit,
  onLock,
  onRefresh,
}) {
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

  // Compare responders to the invited list (if one was given) to find who's
  // missing. Names are matched case-insensitively.
  const responderNames = new Set(responses.map((r) => r.name.toLowerCase()));
  const missing = invitees.filter((n) => !responderNames.has(n.toLowerCase()));

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

      {/* Responded / waiting-on summary */}
      {invitees.length > 0 ? (
        <p className="muted">
          <strong>
            {invitees.length - missing.length} of {invitees.length}
          </strong>{" "}
          invited have responded.
          {missing.length > 0 && <> Waiting on: {missing.join(", ")}.</>}
        </p>
      ) : (
        <p className="muted">
          {responses.length === 0
            ? "No responses yet — be the first, or share the link above."
            : `${responses.length} ${
                responses.length === 1 ? "person has" : "people have"
              } responded.`}
        </p>
      )}

      {responses.length > 0 && (
        <div className="chips">
          {responses.map((p) => (
            <button key={p.name} className="chip" onClick={() => onEdit(p)} title="Edit this response">
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
                <span>
                  <strong>{formatSlot(b.key, allDay)}</strong> — {b.count} of{" "}
                  {responses.length} free ({(namesByKey.get(b.key) || []).join(", ")})
                </span>
                {isOwner &&
                  (finalSlot === b.key ? (
                    <span className="locked-tag">✅ Locked</span>
                  ) : (
                    <button className="btn btn-ghost btn-small" onClick={() => onLock(b.key)}>
                      📌 Lock in
                    </button>
                  ))}
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

// ===========================================================================
// Organizer-only controls (close/reopen + delete)
// ===========================================================================
function OrganizerControls({ closed, onToggleClosed, onDelete }) {
  return (
    <section className="card organizer-controls">
      <h3>Organizer controls</h3>
      <p className="muted">Only you (the creator) can see this on this device.</p>
      <div className="actions">
        <button className="btn btn-ghost" onClick={onToggleClosed}>
          {closed ? "Reopen event" : "Close to new responses"}
        </button>
        <button className="btn btn-danger" onClick={onDelete}>
          Delete event
        </button>
      </div>
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
