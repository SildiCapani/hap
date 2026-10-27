// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const config = getDefaultConfig(__dirname);

// Local web development has no Netlify Functions. The timetable and calendar
// imports are served by the same function code here, so they work on localhost.
const localFunctions = ["uni-calendar", "ical", "quotes"];
config.server.enhanceMiddleware = (middleware) => async (req, res, next) => {
  const name = localFunctions.find((f) =>
    req.url?.startsWith("/.netlify/functions/" + f),
  );
  if (!name) return middleware(req, res, next);
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const file = path.join(__dirname, "netlify/functions", name + ".mjs");
    const { default: handler } = await import(pathToFileURL(file).href);
    const response = await handler(
      new Request("http://localhost" + req.url, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || "",
        },
        body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
      }),
    );
    res.statusCode = response.status;
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/json",
    );
    res.end(await response.text());
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Local function failed" }));
  }
};

module.exports = config;
