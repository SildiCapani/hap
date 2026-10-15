import test from "node:test";
import assert from "node:assert/strict";
import {
  authorized,
  berlinDay,
  generatePlan,
  shift,
  targetWeek,
  validatePlan,
} from "../netlify/lib/meals.mjs";
import mealHandler from "../netlify/functions/meal-plan.mjs";
import generatorHandler from "../netlify/functions/generate-meals-background.mjs";

const secret = "a".repeat(40);
test("authentication fails closed and rejects wrong credentials", () => {
  assert.equal(authorized(new Request("https://example.test"), secret), false);
  assert.equal(
    authorized(
      new Request("https://example.test", {
        headers: { Authorization: "Bearer " + secret },
      }),
      secret,
    ),
    true,
  );
  assert.equal(
    authorized(
      new Request("https://example.test", {
        headers: { Authorization: "Bearer bad" },
      }),
      secret,
    ),
    false,
  );
  assert.equal(authorized(new Request("https://example.test"), ""), false);
});
test("Berlin midnight, Sunday generation and DST select the right week", () => {
  assert.equal(berlinDay(new Date("2026-10-15T22:30:00Z")), "2026-10-16");
  assert.equal(targetWeek(new Date("2026-10-18T06:00:00Z")), "2026-10-19");
  assert.equal(targetWeek(new Date("2026-10-19T06:00:00Z")), "2026-10-19");
  assert.equal(targetWeek(new Date("2026-10-25T06:00:00Z")), "2026-10-26");
});
test("structured API response is parsed and dates are checked", async () => {
  const week = "2026-10-19";
  const result = {
    days: Array.from({ length: 7 }, (_, i) => ({
      date: shift(week, i),
      breakfast: "Porridge",
      lunch: "Bowl",
      dinner: "Pasta",
    })),
    groceries: [{ name: "Hafer", amount: "500 g", category: "Vorrat" }],
  };
  let request;
  const fetcher = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    request = JSON.parse(options.body);
    return Response.json({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(result) }] },
      ],
    });
  };
  const plan = await generatePlan(
    week,
    {
      OPENAI_API_KEY: "test",
      OPENAI_MODEL: "test-model",
      MEAL_PLAN_PROMPT: "1 Person, 60 Euro",
    },
    fetcher,
  );
  assert.equal(plan.weekStart, week);
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  result.days[0].date = "2026-10-18";
  assert.throws(() => validatePlan(result, week));
});
test("failed or incomplete generation does not produce a plan", async () => {
  const env = {
    OPENAI_API_KEY: "test",
    OPENAI_MODEL: "test-model",
    MEAL_PLAN_PROMPT: "test",
  };
  await assert.rejects(
    generatePlan("2026-10-19", env, async () =>
      Response.json({}, { status: 429 }),
    ),
  );
  await assert.rejects(
    generatePlan("2026-10-19", env, async () =>
      Response.json({ status: "incomplete" }),
    ),
  );
  await assert.rejects(generatePlan("2026-10-19", {}));
});
test("public endpoints reject unauthorized requests before accessing storage or AI", async () => {
  process.env.HAP_ACCESS_TOKEN = secret;
  process.env.HAP_JOB_SECRET = secret;
  assert.equal(
    (await mealHandler(new Request("https://example.test"))).status,
    401,
  );
  assert.equal(
    (
      await generatorHandler(
        new Request("https://example.test", { method: "POST" }),
      )
    ).status,
    401,
  );
  assert.equal(
    (await mealHandler(new Request("https://example.test", { method: "POST" })))
      .status,
    405,
  );
});
