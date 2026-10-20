import type { MealPlan, PlannerState } from "./planner";

export const slots = ["breakfast", "lunch", "dinner"] as const;
export const slotLabel = { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen" } as const;

// The week plan as it is now: imported meals become tasks, and edits or
// deletions of those tasks are what the plan view should show.
export function currentMeals(state: PlannerState, plan: MealPlan) {
  const imported = state.importedWeeks.includes(plan.weekStart);
  return plan.days.map((d) => ({
    date: d.date,
    meals: slots.map((slot) => {
      const task = state.tasks.find((t) => t.id === "meal-" + d.date + "-" + slot);
      const current = !imported ? d[slot] : task ? task.title : null;
      return { slot, original: d[slot], current, changed: current !== d[slot] };
    }),
  }));
}

export function mealBasis(state: PlannerState, plan: MealPlan) {
  return currentMeals(state, plan)
    .flatMap((d) => d.meals.map((m) => m.current || ""))
    .join("|");
}

// Groceries follow the current dishes once they were recalculated.
export function groceriesFor(state: PlannerState, plan: MealPlan) {
  const basis = mealBasis(state, plan);
  const changed = currentMeals(state, plan).some((d) => d.meals.some((m) => m.changed));
  const custom = state.groceryList?.weekStart === plan.weekStart ? state.groceryList : null;
  return {
    items: custom ? custom.items : plan.groceries,
    adjusted: !!custom,
    outdated: custom ? custom.basis !== basis : changed,
    basis,
  };
}

export async function recalcGroceries(
  state: Pick<PlannerState, "apiUrl" | "accessToken">,
  dishes: string[],
): Promise<MealPlan["groceries"] | string> {
  if (!state.accessToken) return "Dafür braucht Hap deinen persönlichen App-Zugang (Einstellungen).";
  const response = await fetch(state.apiUrl.replace(/\/$/, "") + "/.netlify/functions/groceries", {
    method: "POST",
    headers: { Authorization: "Bearer " + state.accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ dishes }),
    signal: AbortSignal.timeout(100000),
  }).catch(() => null);
  if (!response) return "Keine Verbindung. Versuch es gleich nochmal.";
  if (response.status === 429) return "Tageslimit erreicht – morgen geht es wieder.";
  if (!response.ok) return "Die Liste konnte gerade nicht berechnet werden (" + response.status + ").";
  return ((await response.json()) as { groceries: MealPlan["groceries"] }).groceries;
}
