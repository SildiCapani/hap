// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const config = getDefaultConfig(__dirname);

// Local web development has no Netlify Functions. The Rapla import is served
// by the same function code here, so the timetable also loads on localhost.
const raplaFunction = pathToFileURL(
  path.join(__dirname, "netlify/functions/uni-calendar.mjs"),
).href;
config.server.enhanceMiddleware = (middleware) => async (req, res, next) => {
  if (!req.url?.startsWith("/.netlify/functions/uni-calendar"))
    return middleware(req, res, next);
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { default: handler } = await import(raplaFunction);
    const response = await handler(
      new Request("http://localhost" + req.url, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
      }),
    );
    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(await response.text());
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Local function failed" }));
  }
};

module.exports = config;
