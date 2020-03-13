const fs = require("fs");
const path = require("path");

const express = require("express");
const app = express();

const http = require("http");
const server = http.Server(app);
const io = require("socket.io")(server);

let last_table = {};


if (fs.existsSync("state.json")) {
  const old = JSON.parse(fs.readFileSync("state.json", "utf8"));
  last_table = old;
  console.log(`Reading in: ${JSON.stringify(old)}`);
} else {
  fs.writeFile("state.json", "{}", function(err) {
    console.log(`Creating file`);
    if (err) {
      console.log(err);
    }
  });
}


function saveState(stock_levels) {
  fs.writeFile("state.json", stock_levels, function(err) {
    if (err) {
        console.log(err);
    }
});
}


// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

server.listen(process.env.PORT || 8000, () => {
  console.log(`[ server.js ] Listening on port ${server.address().port}`);
});

app.use(express.static(__dirname + "/views/"));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/buttons.html"));
});

app.get("/slideshow", (req, res) => {
  res.sendFile(path.join(__dirname, "views/slideshow.html"));
});

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------

io.on("connection", socket => {
  console.log(`[ server.js ] ${socket.id} connected`);
  console.log("Distibuting previous state");
  io.sockets.emit("update table", JSON.stringify(last_table));

  socket.on("update table", table => {
    console.log("Distibuting updates");
    last_table = JSON.parse(table);
    io.sockets.emit("update table", table);
    saveState(table);
  });

  socket.on("disconnect", () => {
    console.log(`[ server.js ] ${socket.id} disconnected`);
  });
});
