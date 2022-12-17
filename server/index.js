const express = require("express");
const path = require("path");

const app = express();

// Serve static assets from the "build" directory
app.use("/static", express.static(path.join(__dirname, "../build/static")));

// Serve the index.html file from the "build" directory
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

const port = 3002;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
