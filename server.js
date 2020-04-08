const fs = require("fs");
const path = require("path");

const express = require("express");
const app = express();
const session = require("express-session");
const sharedsession = require("express-socket.io-session");

const http = require("http");
const server = http.Server(app);
const io = require("socket.io")(server);

const redis = require("redis");
const RedisStore = require("connect-redis")(session);
const redisClient = redis.createClient(process.env.REDIS_URL);

const COOKIE_SECRET = process.env.COOKIE_SECRET || "8OarM0c9KnkjM8ucDorbFTU3ssST4VIx";

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

let redisSession = session({
  secret: COOKIE_SECRET,
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: true,
});
app.use(redisSession);
io.use(sharedsession(redisSession));

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

app.use(express.static(__dirname + "/views/"));

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);
  console.log("Distibuting previous state");
  io.to(`${socket.id}`).emit("update table", JSON.stringify(last_table));
  io.to(`${socket.id}`).emit("config", CONFIG);

  redisClient.sadd(socket.handshake.session.id, socket.id);

  redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
    if (reply) {
      io.to(`${socket.id}`).emit("auth", true);
    } else {
      io.to(`${socket.id}`).emit("auth", false);
    }
  });

  socket.on("update table", (table) => {
    redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
      if (reply) {
        console.log(`Distibuting whole table from ${socket.id}`);
        last_table = JSON.parse(table);
        socket.broadcast.emit("update table", table);
        saveState(table);
      } else {
        console.log(`%Unauthenticated client ${socket.id} attempted to change the matrix with: ${table}`);
      }
    });
  });

  socket.on("update single", (stock_level) => {
    redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
      if (reply) {
        console.log(
          `Distibuting updates from ${socket.id} (number ${stock_level["number"]} = ${stock_level["level"]})`
        );
        last_table[stock_level["number"]] = stock_level["level"];
        io.sockets.emit("update single", stock_level);
        saveState(JSON.stringify(last_table));
      } else {
        console.log(
          `Unauthenticated client ${socket.id} attempted to change ${stock_level["number"]} to ${stock_level["level"]}`
        );
      }
    });
  });

  socket.on("config", (configuration) => {
    redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
      if (reply) {
        console.log("Distributing configuration:");
        console.log(configuration);
        io.sockets.emit("config", configuration);
        CONFIG = configuration;
      } else {
        console.log(
          `Unauthenticated client ${socket.id} attempted to change the config with: ${JSON.stringify(configuration)}`
        );
      }
    });
  });

  socket.on("auth", (code) => {
    if (code == "1234") {
      console.log(`Client - ${socket.handshake.session.id} - correct code`);
      redisClient.sadd(["authed_ids", socket.handshake.session.id]);
      redisClient.smembers(socket.handshake.session.id, (err, reply) => {
        for (const socket of reply) {
          io.to(`${socket}`).emit("auth", true);
        }
      });
    } else {
      console.log(`Client - ${socket.handshake.session.id} - wrong code`);
      redisClient.srem(["authed_ids", socket.handshake.session.id]);
      redisClient.smembers(socket.handshake.session.id, (err, reply) => {
        for (const socket of reply) {
          io.to(`${socket}`).emit("auth", false);
        }
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});
