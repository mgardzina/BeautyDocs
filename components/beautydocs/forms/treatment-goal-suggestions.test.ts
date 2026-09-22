import assert from "node:assert/strict";
import test from "node:test";
import {
  filterTreatmentGoalSuggestions,
  getTreatmentGoalSuggestions,
} from "./treatment-goal-suggestions";

test("returns treatment-specific goals", () => {
  const suggestions = getTreatmentGoalSuggestions("depilacja-laserowa");

  assert.ok(suggestions.includes("Trwała redukcja owłosienia"));
  assert.ok(!suggestions.includes("Powiększenie ust"));
});

test("filters suggestions without requiring Polish diacritics", () => {
  const suggestions = getTreatmentGoalSuggestions("depilacja-laserowa");

  assert.deepEqual(filterTreatmentGoalSuggestions(suggestions, "wrastajac wlos"), [
    "Ograniczenie wrastających włosków",
  ]);
  assert.deepEqual(filterTreatmentGoalSuggestions(suggestions, "redukcja owlosienia"), [
    "Redukcja owłosienia w wybranym obszarze",
    "Trwała redukcja owłosienia",
  ]);
});
