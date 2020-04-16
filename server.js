#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");

const bcrypt = require("bcryptjs");
const express = require("express");
const flash = require("express-flash");
const session = require("express-session");
const sharedsession = require("express-socket.io-session");
const redis = require("redis");

const ADMIN_CODE = process.env.ADMIN_CODE;
const COOKIE_SECRET = process.env.COOKIE_SECRET || "8OarM0c9KnkjM8ucDorbFTU3ssST4VIx";
const ENABLE_API = process.env.ENABLE_API || "false";
const REDIS_URL = process.env.REDIS_URL;

const app = express();
const server = http.Server(app);
const io = require("socket.io")(server);
const redisClient = redis.createClient(REDIS_URL);
const RedisStore = require("connect-redis")(session);

let last_config = {};
let last_table = {};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Set up server
const redisSession = session({
  secret: COOKIE_SECRET,
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: false
});

io.use(sharedsession(redisSession));
app.set("view-engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(redisSession);

// Start the server
server.listen(process.env.PORT || 8000, () => {
  console.log(`Listening on port ${server.address().port}`);
});

// Read in previous state if it exists, initialise all as full if not
redisClient.hgetall("stock_levels", (err, reply) => {
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

// Read in previous config settings, initialise with defaults if not
redisClient.hgetall("config", (err, reply) => {
  if (reply != null) {
    console.log(`Reading in: ${JSON.stringify(reply)}`);
    const confirm = reply.confirm === "true" ? true : false;
    const low_enable = reply.low_enable === "true" ? true : false;
    last_config = { confirm: confirm, low_enable: low_enable };
  } else {
    console.log(`Initialising config`);
    last_config = { confirm: true, low_enable: false };
  }
  redisClient.hset("config", "confirm", last_config.confirm);
  redisClient.hset("config", "low_enable", last_config.low_enable);
});

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

// Save the state from a JSON string of stock_levels to redis
const saveState = stock_levels => {
  for (const [number, level] of Object.entries(JSON.parse(stock_levels))) {
    redisClient.hset("stock_levels", number, level);
  }
};

// Used to stop unauthenticated clients getting to pages
const checkAuthenticated = (req, res, next) => {
  redisClient.sismember("authed_ids", req.session.id, (err, reply) => {
    if (reply) {
      return next();
    }
    res.redirect("/login");
  });
};

// Used to stop authenticated clients getting to pages
const checkNotAuthenticated = (req, res, next) => {
  redisClient.sismember("authed_ids", req.session.id, (err, reply) => {
    if (reply) {
      return res.redirect("/");
    }
    next();
  });
};

// ---------------------------------------------------------------------------
// Routes - main
// ---------------------------------------------------------------------------

// Core pages
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

// Other routes
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

// Routes for reveal (the slideshow package)
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
// Routes - authentication
// ---------------------------------------------------------------------------

app.post("/users", (req, res) => {
  // Store the name in the users session
  const name = req.body.name;
  const code = req.body.code;
  const thisSession = req.session.id;

  // Check the code entered
  bcrypt.compare(code, ADMIN_CODE, (err, resp) => {
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

// ---------------------------------------------------------------------------
// Routes - API
// ---------------------------------------------------------------------------

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

      // Save the whole table at once
      console.log("Saving whole table");
      last_table = req.body;
      io.sockets.emit("update table", JSON.stringify(last_table));
      saveState(JSON.stringify(last_table));
    } else {
      // If the number of entries is under 80, update the levels one-by-one
      const name = req.session.name;
      for (const [number, level] of Object.entries(req.body)) {
        console.log(`${Date.now()}, {"name": ${name}, "number": "${number}", "level": "${level}"}`);
        redisClient.zadd("log", Date.now(), `{"name": ${name}, "number": "${number}", "level": "${level}"}`);
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
  const name = req.session.name;
  const number = req.params.number;
  const level = req.params.level;

  if (ENABLE_API == "true") {
    if (number <= 80) {
      // Update the levels one-by-one
      console.log(`${Date.now()}, {"name": ${name}, "number": "${number}", "level": "${level}"}`);
      redisClient.zadd("log", Date.now(), `{"name": ${name}, "number": "${number}", "level": "${level}"}`);
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

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------

io.on("connection", socket => {
  // When a new client connects, update them with the current state of things
  console.log(`Client ${socket.id} connected`);
  console.log("Distibuting previous state");
  io.to(`${socket.id}`).emit("update table", JSON.stringify(last_table));
  io.to(`${socket.id}`).emit("config", last_config);

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

        // Save the whole table at once
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
    const name = socket.handshake.session.name;
    const number = stock_level["number"];
    const level = stock_level["level"];

    redisClient.sismember("authed_ids", socket.handshake.session.id, (err, reply) => {
      if (reply) {
        // Update the levels one-by-one
        console.log(`${Date.now()}, {"name": ${name}, "number": "${number}", "level": "${level}"}`);
        redisClient.zadd("log", Date.now(), `{"name": ${name}, "number": "${number}", "level": "${level}"}`);
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
        // Distribute and save the configuration
        console.log("Distributing configuration:");
        console.log(configuration);
        io.sockets.emit("config", configuration);
        last_config = configuration;
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
