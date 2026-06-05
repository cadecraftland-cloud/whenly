"use client";

// ---------------------------------------------------------------------------
// AvailabilityGrid — the clickable grid of days (columns) x times (rows).
//
// It works in two modes:
//   mode="edit"  -> the current person paints the cells they're free. Clicking
//                   or dragging toggles cells. Calls onChange with the new set.
//   mode="view"  -> read-only heatmap. Each cell is shaded by how many people
//                   are free, and hovering a cell reveals who.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { slotKey, formatDateHeader, formatTime } from "../lib/event";

export default function AvailabilityGrid({
  dates,
  times,
  mode = "edit",
  selected, // edit mode: a Set of slot keys the current person picked
  onChange, // edit mode: called with the updated Set
  counts, // view mode: a Map of slot key -> number of people free
  namesByKey, // view mode: a Map of slot key -> array of names
  totalPeople, // view mode: used to scale the color (full color = everyone)
  allDay = false, // whole-day mode: a single "All day" row per day
}) {
  // --- Drag-to-paint bookkeeping (edit mode only) --------------------------
  // When you press the mouse/finger down on a cell, we remember whether we are
  // ADDING availability or REMOVING it (based on that first cell), then any cell
  // you drag across gets the same action. This makes painting feel natural.
  const isPainting = useRef(false);
  const paintMode = useRef("add"); // "add" or "remove"

  // Update one cell. We pass a function to onChange (a "functional update") so
  // several quick changes during a fast drag stack correctly instead of each
  // one overwriting the last.
  function applyToCell(key) {
    if (mode !== "edit") return;
    onChange((prev) => {
      const next = new Set(prev);
      if (paintMode.current === "add") next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function handlePointerDown(key) {
    if (mode !== "edit") return;
    isPainting.current = true;
    // If the first cell is already selected, we're erasing; otherwise filling.
    paintMode.current = selected.has(key) ? "remove" : "add";
    applyToCell(key);
  }

  function handlePointerEnter(key) {
    if (mode !== "edit" || !isPainting.current) return;
    applyToCell(key);
  }

  function stopPainting() {
    isPainting.current = false;
  }

  // Pick a background color for a cell in view mode: white (nobody) up to a
  // strong green (everybody). We blend toward green based on the fraction free.
  function heatColor(count) {
    if (!count) return "#ffffff";
    const fraction = totalPeople > 0 ? count / totalPeople : 0;
    // Light green -> dark green. Mix lightness from 92% down to 38%.
    const lightness = 92 - fraction * 54;
    return `hsl(140, 65%, ${lightness}%)`;
  }

  return (
    // onPointerUp/Leave on the wrapper guarantees we stop painting even if the
    // pointer is released outside a cell.
    <div className="grid-wrapper" onPointerUp={stopPainting} onPointerLeave={stopPainting}>
      <table className="grid" style={{ touchAction: mode === "edit" ? "none" : "auto" }}>
        <thead>
          <tr>
            <th className="time-label-cell"></th>
            {dates.map((dateId) => (
              <th key={dateId} className="date-header">
                {formatDateHeader(dateId)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((minutes) => (
            <tr key={minutes}>
              <th className="time-label-cell">
                {allDay ? "All day" : formatTime(minutes)}
              </th>
              {dates.map((dateId) => {
                const key = slotKey(dateId, minutes);

                if (mode === "edit") {
                  const isOn = selected.has(key);
                  return (
                    <td
                      key={key}
                      className={`cell ${isOn ? "cell-on" : ""}`}
                      onPointerDown={() => handlePointerDown(key)}
                      onPointerEnter={() => handlePointerEnter(key)}
                    />
                  );
                }

                // view mode (heatmap)
                const count = counts.get(key) || 0;
                const names = namesByKey.get(key) || [];
                return (
                  <td
                    key={key}
                    className="cell cell-view"
                    style={{ backgroundColor: heatColor(count) }}
                    title={
                      count
                        ? `${count} free: ${names.join(", ")}`
                        : "Nobody free yet"
                    }
                  >
                    {count > 0 ? count : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
