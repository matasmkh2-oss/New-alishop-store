import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Prevent stale caching in development / preview
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Serve static assets
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  maxAge: 0
}));

// Single Page Application route fallback
app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Ali Shop store running on http://0.0.0.0:${PORT}`);
});
