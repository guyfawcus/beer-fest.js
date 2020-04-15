const fs = require("fs");
const path = require("path");

const bcrypt = require("bcryptjs");
const express = require("express");
const app = express();
const session = require("express-session");
const sharedsession = require("express-socket.io-session");

const flash = require("express-flash");

const http = require("http");
const server = http.Server(app);
const io = require("socket.io")(server);

const redis = require("redis");
const RedisStore = require("connect-redis")(session);
const redisClient = redis.createClient(process.env.REDIS_URL);

const COOKIE_SECRET = process.env.COOKIE_SECRET || "8OarM0c9KnkjM8ucDorbFTU3ssST4VIx";
const ADMIN_CODE = process.env.ADMIN_CODE;
const ENABLE_API = process.env.ENABLE_API || "false";

let last_table = {};
let CONFIG = {};

redisClient.hgetall("stock_levels", function(err, reply) {
  if (reply != null) {
    console.log(`Reading in: ${JSON.stringify(reply)}`);
    last_table = reply;
  } else {
    console.log(`Starting off state matrix`);
    for (i = 1; i <= 80; i++) {
      last_table[i] = "full";
    }
    saveState(JSON.stringify(last_table));
  }
});

redisClient.hgetall("config", function(err, reply) {
  if (reply != null) {
    console.log(`Reading in: ${JSON.stringify(reply)}`);
    let confirm = reply.confirm === "true" ? true : false;
    let low_enable = reply.low_enable === "true" ? true : false;
    CONFIG = { confirm: confirm, low_enable: low_enable };
  } else {
    console.log(`Initialising config`);
    CONFIG = { confirm: true, low_enable: false };
  }
  redisClient.hset("config", "confirm", CONFIG.confirm);
  redisClient.hset("config", "low_enable", CONFIG.low_enable);
});

function saveState(stock_levels) {
  for (const [number, level] of Object.entries(JSON.parse(stock_levels))) {
    redisClient.hset("stock_levels", number, level);
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

server.listen(process.env.PORT || 8000, () => {
  console.log(`Listening on port ${server.address().port}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let redisSession = session({
  secret: COOKIE_SECRET,
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: false
});
app.use(redisSession);
io.use(sharedsession(redisSession));

app.set("view-engine", "ejs");
app.use(flash());

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

app.get("/settings", checkAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views/settings.html"));
});

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});

app.post("/users", (req, res) => {
  const name = req.body.name;
  const code = req.body.code;
  const thisSession = req.session.id;

  bcrypt.compare(code, ADMIN_CODE, function(err, resp) {
    if (resp) {
      console.log(`Client - ${thisSession} - has entered the correct code`);
      req.session.name = name;
      redisClient.sadd(["authed_ids", thisSession]);
      redisClient.smembers(thisSession, (err, reply) => {
        for (const socket of reply) {
          io.to(`${socket}`).emit("auth", true);
        }
      });
      res.redirect("/");
    } else {
      console.log(`Client - ${thisSession} - has enterted the wrong code (${code})`);
      redisClient.srem(["authed_ids", thisSession]);
      redisClient.smembers(thisSession, (err, reply) => {
        for (const socket of reply) {
          io.to(`${socket}`).emit("auth", false);
        }
      });
      req.flash("error", "Wrong code, please try again");
      res.redirect("login");
    }
  });
});

app.get("/logout", (req, res) => {
  const thisSession = req.session.id;
  redisClient.srem(["authed_ids", thisSession]);
  redisClient.smembers(thisSession, (err, reply) => {
    for (const socket of reply) {
      io.to(`${socket}`).emit("auth", false);
    }
  });
  res.redirect("/");
});

app.get("/robots.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "robots.txt"));
});

app.get("/.well-known/security.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "security.txt"));
});

app.get("/.well-known/keybase.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "keybase.txt"));
});

app.get("/humans.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "humans.txt"));
});

// API
app.get("/api/stock_levels", (req, res) => {
  res.send(last_table);
});

app.get("/api/stock_levels/:number", (req, res) => {
  res.send(last_table[req.params.number]);
});

app.post("/api/stock_levels", (req, res) => {
  if (ENABLE_API == "true") {
    if (Object.keys(req.body).length > 80) {
      console.log("Too many items in JSON");
      res.status(400).send("Too many items in JSON");
      return;
    } else if (Object.keys(req.body).length === 80) {
      // Backup log if it exists and set to expire in a week
      redisClient.exists("log", (err, reply) => {
        if (reply) {
          console.log("Backing up and wiping log");
          const log_backup_name = `log-backup-${Date.now()}`;
          redisClient.rename("log", log_backup_name);
          redisClient.expire(log_backup_name, 1 * 60 * 60 * 24 * 7);
        }
      });

      console.log("Saving whole table");
      last_table = req.body;
      io.sockets.emit("update table", JSON.stringify(last_table));
      saveState(JSON.stringify(last_table));
    } else {
      for (let [number, level] of Object.entries(req.body)) {
        console.log(`${Date.now()}, {"number": "${number}", "level": "${level}"}`);
        redisClient.zadd("log", Date.now(), `{"number": "${number}", "level": "${level}"}`);
        if (last_table[number] != level) {
          last_table[number] = level;
          io.sockets.emit("update single", { number: number, level: level });
          saveState(JSON.stringify(last_table));
        }
      }
    }
    res.send(last_table);
  } else {
    console.log("API use is not enabled");
    res.status(403).send("API use is not enabled");
  }
});

app.post("/api/stock_levels/:number/:level", (req, res) => {
  const number = req.params.number;
  const level = req.params.level;

  if (ENABLE_API == "true") {
    if (number <= 80) {
      console.log(`${Date.now()}, {"number": "${number}", "level": "${level}"}`);
      redisClient.zadd("log", Date.now(), `{"number": "${number}", "level": "${level}"}`);
      if (last_table[number] != level) {
        last_table[number] = level;
        io.sockets.emit("update single", { number: number, level: level });
        saveState(JSON.stringify(last_table));
      }
      res.send(last_table);
    } else {
      console.log("Number too high");
      res.status(400).send("Number too high");
    }
  } else {
    console.log("API use is not enabled");
    res.status(403).send("API use is not enabled");
  }
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

io.on("connection", socket => {
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

  socket.on("update table", table => {
    redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
      if (reply) {
        // Backup log if it exists and set to expire in a week
        redisClient.exists("log", (err, reply) => {
          if (reply) {
            console.log("Backing up and wiping log");
            const log_backup_name = `log-backup-${Date.now()}`;
            redisClient.rename("log", log_backup_name);
            redisClient.expire(log_backup_name, 1 * 60 * 60 * 24 * 7);
          }
        });

        console.log(`Distibuting whole table from ${socket.id}`);
        last_table = JSON.parse(table);
        socket.broadcast.emit("update table", table);
        saveState(table);
      } else {
        console.log(`%Unauthenticated client ${socket.id} attempted to change the matrix with: ${table}`);
      }
    });
  });

  socket.on("update single", stock_level => {
    const number = stock_level["number"];
    const level = stock_level["level"];

    redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
      if (reply) {
        console.log(`${Date.now()}, {"number": "${number}", "level": "${level}"}`);
        redisClient.zadd("log", Date.now(), `{"number": "${number}", "level": "${level}"}`);
        console.log(`Distibuting updates from ${socket.id} (number ${number} = ${level})`);
        last_table[number] = level;
        io.sockets.emit("update single", stock_level);
        saveState(JSON.stringify(last_table));
      } else {
        console.log(`Unauthenticated client ${socket.id} attempted to change ${number} to ${level}`);
      }
    });
  });

  socket.on("config", configuration => {
    redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
      if (reply) {
        console.log("Distributing configuration:");
        console.log(configuration);
        io.sockets.emit("config", configuration);
        CONFIG = configuration;
        redisClient.hset("config", "confirm", configuration.confirm);
        redisClient.hset("config", "low_enable", configuration.low_enable);
      } else {
        console.log(
          `Unauthenticated client ${socket.id} attempted to change the config with: ${JSON.stringify(configuration)}`
        );
      }
    });
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
    redisClient.srem(socket.handshake.session.id, socket.id);
  });
});

function checkAuthenticated(req, res, next) {
  redisClient.sismember("authed_ids", req.session.id, (err, reply) => {
    if (reply) {
      return next();
    }
    res.redirect("/login");
  });
}

function checkNotAuthenticated(req, res, next) {
  redisClient.sismember("authed_ids", req.session.id, (err, reply) => {
    if (reply) {
      return res.redirect("/");
    }
    next();
  });
}
