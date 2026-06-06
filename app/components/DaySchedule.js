"use client";

// ---------------------------------------------------------------------------
// DaySchedule — a mobile-friendly way to pick / view availability.
//
// Instead of one wide grid (days as columns) that needs left-right scrolling,
// this shows a calendar of day buttons that wrap onto multiple rows. You tap a
// day, then tap the times for that day in a tall, easy-to-touch list. No
// horizontal scrolling, big tap targets.
//
// Modes:
//   edit  -> tap days + times to build YOUR availability (calls onChange)
//   view  -> read-only results, shaded by how many people are free
// Whole-day events skip the time step: the day buttons themselves are toggles.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { slotKey, formatTime } from "../lib/event";

// "2026-06-08" -> { weekday: "Mon", month: "Jun", dayNum: 8 }
function dayParts(dateId) {
  const d = new Date(`${dateId}T00:00`);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    month: d.toLocaleDateString(undefined, { month: "short" }),
    dayNum: d.getDate(),
  };
}

export default function DaySchedule({
  dates,
  times,
  allDay = false,
  mode = "edit",
  selected, // edit: Set of slot keys
  onChange, // edit: receives updated Set
  counts, // view: Map slotKey -> count
  namesByKey, // view: Map slotKey -> names[]
  totalPeople, // view: for color scaling
}) {
  // Which day's times are showing (edit mode, timed events).
  const [activeDate, setActiveDate] = useState(dates[0]);

  // White (nobody) -> green (everybody).
  function heatColor(count) {
    if (!count) return "#ffffff";
    const frac = totalPeople > 0 ? count / totalPeople : 0;
    return `hsl(140, 65%, ${92 - frac * 54}%)`;
  }

  // --- edit helpers (use functional updates so quick taps don't clobber) ---
  function toggle(key) {
    onChange((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function setWholeDay(dateId, on) {
    onChange((prev) => {
      const next = new Set(prev);
      for (const m of times) {
        const k = slotKey(dateId, m);
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }
  const daySelectedCount = (dateId) =>
    times.reduce((n, m) => n + (selected.has(slotKey(dateId, m)) ? 1 : 0), 0);

  // ======================= WHOLE-DAY EVENTS =======================
  if (allDay) {
    return (
      <div className="calendar">
        {dates.map((dateId) => {
          const key = slotKey(dateId, 0);
          const p = dayParts(dateId);

          if (mode === "edit") {
            const on = selected.has(key);
            return (
              <button
                type="button"
                key={dateId}
                className={`day-btn ${on ? "selected" : ""}`}
                onClick={() => toggle(key)}
              >
                <span className="wd">{p.weekday}</span>
                <span className="dn">{p.dayNum}</span>
                <span className="mo">{p.month}</span>
              </button>
            );
          }

          const count = counts.get(key) || 0;
          const names = namesByKey.get(key) || [];
          return (
            <div
              key={dateId}
              className="day-btn view"
              style={{ backgroundColor: heatColor(count) }}
              title={count ? `${count} free: ${names.join(", ")}` : "Nobody free yet"}
            >
              <span className="wd">{p.weekday}</span>
              <span className="dn">{p.dayNum}</span>
              <span className="badge">{count || ""}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ============== RESULTS (timed): stack every day vertically ==============
  if (mode === "view") {
    return (
      <div className="view-days">
        {dates.map((dateId) => {
          const p = dayParts(dateId);
          return (
            <div key={dateId} className="view-day">
              <h4>
                {p.weekday} {p.month} {p.dayNum}
              </h4>
              <div className="time-list">
                {times.map((m) => {
                  const key = slotKey(dateId, m);
                  const count = counts.get(key) || 0;
                  const names = namesByKey.get(key) || [];
                  return (
                    <div
                      key={m}
                      className="time-row"
                      style={{ backgroundColor: heatColor(count) }}
                      title={count ? names.join(", ") : "Nobody free yet"}
                    >
                      <span>{formatTime(m)}</span>
                      <span className="count">{count ? `${count} free` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============ EDIT (timed): calendar + the active day's times ============
  const ap = dayParts(activeDate);
  return (
    <div>
      <div className="calendar">
        {dates.map((dateId) => {
          const dp = dayParts(dateId);
          const n = daySelectedCount(dateId);
          return (
            <button
              type="button"
              key={dateId}
              className={`day-btn ${dateId === activeDate ? "active" : ""} ${
                n > 0 ? "has-sel" : ""
              }`}
              onClick={() => setActiveDate(dateId)}
            >
              <span className="wd">{dp.weekday}</span>
              <span className="dn">{dp.dayNum}</span>
              {n > 0 && <span className="badge">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="day-detail">
        <div className="day-detail-head">
          <strong>
            {ap.weekday} {ap.month} {ap.dayNum}
          </strong>
          <div className="day-actions">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setWholeDay(activeDate, true)}
            >
              Select all
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setWholeDay(activeDate, false)}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="time-list">
          {times.map((m) => {
            const key = slotKey(activeDate, m);
            const on = selected.has(key);
            return (
              <button
                type="button"
                key={m}
                className={`time-toggle ${on ? "on" : ""}`}
                onClick={() => toggle(key)}
              >
                <span>{formatTime(m)}</span>
                <span className="check">{on ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
