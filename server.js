const fs = require("fs");
const path = require("path");

const express = require("express");
const app = express();

const http = require("http");
const server = http.Server(app);
const io = require("socket.io")(server);

const state_file = "state.json";
let last_table = {};
let CONFIG = { confirm: true, low_enable: false };

for (i = 1; i <= 80; i++) {
  last_table[i] = "full";
}

if (fs.existsSync(state_file)) {
  const old = JSON.parse(fs.readFileSync(state_file, "utf8"));
  last_table = old;
  console.log(`Reading in: ${JSON.stringify(old)}`);
} else {
  fs.writeFile(state_file, JSON.stringify(last_table), function(err) {
    console.log(`Creating file`);
    if (err) {
      console.log(err);
    }
  });
}

function saveState(stock_levels) {
  fs.writeFile(state_file, stock_levels, function(err) {
    if (err) {
      console.log(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

server.listen(process.env.PORT || 8000, () => {
  console.log(`Listening on port ${server.address().port}`);
});

app.use(express.static(__dirname + "/views/"));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/index.html"));
});

app.get("/availability", (req, res) => {
  res.sendFile(path.join(__dirname, "views/buttons.html"));
});

app.get("/slideshow", (req, res) => {
  res.sendFile(path.join(__dirname, "views/slideshow.html"));
});

app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "views/settings.html"));
});

// Routes for reveal
app.get("/css/reset.css", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/reveal.js/css/reset.css"));
});
app.get("/css/reveal.css", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/reveal.js/css/reveal.css"));
});
app.get("/css/theme/black.css", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/reveal.js/css/theme/black.css"));
});
app.get("/js/reveal.js", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/reveal.js/js/reveal.js"));
});

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);
  console.log("Distibuting previous state");
  io.to(`${socket.id}`).emit("update table", JSON.stringify(last_table));
  io.to(`${socket.id}`).emit("config", CONFIG);

  socket.on("update table", (table) => {
    console.log(`Distibuting whole table from ${socket.id}`);
    last_table = JSON.parse(table);
    socket.broadcast.emit("update table", table);
    saveState(table);
  });

  socket.on("update single", (stock_level) => {
    console.log(`Distibuting updates from ${socket.id} (number ${stock_level["number"]} = ${stock_level["level"]})`);
    last_table[stock_level["number"]] = stock_level["level"];
    socket.broadcast.emit("update single", stock_level);
    saveState(JSON.stringify(last_table));
  });

  socket.on("config", (configuration) => {
    console.log("Distributing configuration:");
    console.log(configuration);
    io.sockets.emit("config", configuration);
    CONFIG = configuration;
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});
