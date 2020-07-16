#!/usr/bin/env node
'use strict'

// Built in packages
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')

// Express related packages
const compression = require('compression')
const connectRedis = require('connect-redis')
const express = require('express')
const expressEnforcesSsl = require('express-enforces-ssl')
const expressFlash = require('express-flash')
const expressSocketIoSession = require('express-socket.io-session')
const featurePolicy = require('feature-policy')
const helmet = require('helmet')
const session = require('express-session')

// Other packages
const bcrypt = require('bcryptjs')
const csvToJson = require('csvtojson')
const socketIo = require('socket.io')
const redis = require('redis')

// ---------------------------------------------------------------------------
// Variable definitions
// ---------------------------------------------------------------------------
const TEMP_UNHASHED = crypto.randomBytes(24).toString('hex')
const ADMIN_CODE = process.env.ADMIN_CODE || bcrypt.hashSync(TEMP_UNHASHED, 10)
const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(64).toString('hex')

if (!process.env.ADMIN_CODE) {
  console.log(
    '\x1b[33m%s\x1b[0m',
    `To be able to log in easily, please generate a secure $ADMIN_CODE environment variable using utils/codegen.js
For the moment though, you can log in with "${TEMP_UNHASHED}"\n`
  )
}

if (!process.env.COOKIE_SECRET) {
  console.log(
    '\x1b[33m%s\x1b[0m',
    'To have logins persist, please generate a secure $COOKIE_SECRET environment variable using utils/codegen.js\n'
  )
}

const ENABLE_API = process.env.ENABLE_API || 'false'
const NODE_ENV = process.env.NODE_ENV || ''
const REDIS_URL = process.env.REDIS_URL || ''
const BEERS_FILE = process.env.BEERS_FILE || './public/downloads/current-beers.csv'

/** @type {configObj} */
let last_config = {}

/** @type{stockLevelsObj} */
let last_table = {}

/** @type{beersObj} */
let beers = {}

/** The total number of availability buttons */
const NUM_OF_BUTTONS = 80

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
/**
 * Object to store the configuration state
 * @typedef {object} configObj
 * @property {boolean} confirm
 * @property {boolean} low_enable
 */

/** @typedef {import('public/js/core.js').stockLevelsObj} stockLevelsObj */
/** @typedef {import('public/js/core.js').beersObj} beersObj */
/** @typedef {import('public/js/core.js').levelValues} levelValues */

// ---------------------------------------------------------------------------
// Initial setup
// ---------------------------------------------------------------------------
const app = express()
const redisClient = redis.createClient({ url: REDIS_URL })
const RedisStore = connectRedis(session)

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------
const sessionOptions = {
  name: 'sessionId',
  cookie: { sameSite: 'strict' },
  secret: COOKIE_SECRET,
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: true
}

if (NODE_ENV === 'production') {
  app.use(expressEnforcesSsl())
  app.enable('trust proxy')
  sessionOptions.cookie.secure = true
  sessionOptions.name = '__Host-sessionId'
}

app.use(helmet())
app.use(helmet.referrerPolicy({ policy: 'same-origin' }))
app.use(
  featurePolicy({
    features: {
      accelerometer: ["'none'"],
      ambientLightSensor: ["'none'"],
      camera: ["'none'"],
      geolocation: ["'none'"],
      gyroscope: ["'none'"],
      magnetometer: ["'none'"],
      microphone: ["'none'"],
      serial: ["'none'"],
      usb: ["'none'"]
    }
  })
)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],
      connectSrc: ["'self'", 'ws:'],
      fontSrc: ["'self'"],
      frameSrc: ["'self'"],
      imgSrc: ["'self'"],
      manifestSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      reportUri: '/report-violation'
    }
  })
)

const cspParser = express.json({
  type: ['json', 'application/csp-report']
})

app.post('/report-violation', cspParser, (req, res) => {
  const srcFile = (req.body['csp-report'] && req.body['csp-report']['source-file']) || ''

  // Ignore violations because of onloadwff.js, it's a LastPass thing that can be ignored
  if (srcFile.includes('onloadwff.js')) {
    res.status(204).end()
    return
  }

  if (req.body) {
    console.log('CSP Violation: ', req.body)
  } else {
    console.log('CSP Violation: No data received!')
  }
  res.status(204).end()
})

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// Set up server
const server = new http.Server(app)
const io = socketIo(server, { cookie: false, serveClient: false })
const redisSession = session(sessionOptions)

io.use(expressSocketIoSession(redisSession))
app.set('view-engine', 'ejs')

app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(expressFlash())
app.use(redisSession)

// Start the server
server.listen(process.env.PORT || 8000, () => {
  console.log(`Listening on port ${server.address().port}`)
})

// Read in previous state if it exists, initialise all as full if not
redisClient.hgetall('stock_levels', (err, reply) => {
  if (err) handleError("Couldn't get stock levels from Redis", err)

  if (reply != null) {
    console.log(`Reading in: ${JSON.stringify(reply)}`)
    last_table = reply
  } else {
    console.log('Starting off state matrix')
    for (let number = 1; number <= NUM_OF_BUTTONS; number++) {
      last_table[number] = 'full'
    }
    saveState(last_table)
  }
})

// Read in previous config settings, initialise with defaults if not
redisClient.hgetall('config', (err, reply) => {
  if (err) handleError("Couldn't get config from Redis", err)

  if (reply != null) {
    console.log(`Reading in: ${JSON.stringify(reply)}`)
    // Convert the true/false strings to bools
    const confirm = reply.confirm === 'true'
    const low_enable = reply.low_enable === 'true'
    last_config = { confirm: confirm, low_enable: low_enable }
  } else {
    console.log('Initialising config')
    last_config = { confirm: true, low_enable: false }
  }
  redisClient.hset('config', 'confirm', last_config.confirm.toString())
  redisClient.hset('config', 'low_enable', last_config.low_enable.toString())
})

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
redisClient.on('error', (error) => {
  if (error.code === 'ECONNREFUSED') {
    console.error("Can't connect to Redis")
  } else {
    console.error(error.message)
  }
  process.exit(1)
})

const handleError = (message, error) => {
  console.error(`${message} - ${error.message})`)
  process.exit(1)
}

process.once('SIGINT', () => gracefulShutdown())
process.once('SIGQUIT', () => gracefulShutdown())
process.once('SIGTERM', () => gracefulShutdown())
process.once('SIGUSR2', () => gracefulShutdown())

const gracefulShutdown = () => {
  console.log('Shutting down server')

  // Clean up old session-socket mapping(s), new mappings will be created on restart
  redisClient.keys('sock:*', (err, reply) => {
    if (err) handleError("Couldn't get socket mappings from Redis", err)
    if (reply.length === 0) process.exit()

    redisClient.del(reply, (err, reply) => {
      if (err) handleError("Couldn't delete socket mappings from Redis", err)
      console.log(`Removed ${reply} session-socket mapping(s)`)

      process.exit()
    })
  })
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------
/**
 * Update a single level
 * @param {string} name The of the user
 * @param {number} number The number of the beer
 * @param {levelValues} level The level it the beer is being set to
 */
function updateSingle(name, number, level) {
  const timeObj = new Date()
  const epochTime = timeObj.getTime()
  const singleUpdateObj = {
    epoch_time: epochTime,
    name: name,
    number: number,
    level: level
  }
  redisClient.zadd('log', `${epochTime}`, JSON.stringify(singleUpdateObj))
  console.log(`Distributing updates from ${name} (number ${number} = ${level})`)
  if (last_table[number] !== level) {
    last_table[number] = level
    io.sockets.emit('update-single', singleUpdateObj)
    saveState(last_table)
  }
}

/**
 * This takes in a {@link stockLevelsObj} and emits any differences from
 * the current state using {@link updateSingle}.
 * @param {string} name The name of the user
 * @param {stockLevelsObj} stock_levels The object with all of the stock levels
 */
function updateRequired(name, stock_levels) {
  for (const [number, level] of Object.entries(stock_levels)) {
    if (level !== last_table[number]) {
      updateSingle(name, Number(number), level)
    }
  }
}

/**
 * This takes in a {@link stockLevelsObj} and emits it to all connected clients
 * after backing up and wiping the current log
 * @param {string} name The name of the user
 * @param {stockLevelsObj} stock_levels The object with all of the stock levels
 */
function replaceAll(name, stock_levels) {
  // Backup log if it exists and set to expire in a week
  redisClient.exists('log', (err, reply) => {
    if (err) handleError("Couldn't check if log exists with Redis", err)
    if (reply) {
      console.log('Backing up and wiping log')
      const log_backup_name = `log-backup-${Date.now()}`
      redisClient.rename('log', log_backup_name)
      redisClient.expire(log_backup_name, 1 * 60 * 60 * 24 * 7)
    }
  })

  // Save the whole table at once
  console.log(`Distributing whole table from ${name}`)
  last_table = stock_levels
  io.sockets.emit('replace-all', stock_levels)
  saveState(stock_levels)
}

/**
 * Save the state from a JSON string of stock_levels to redis
 * @param {stockLevelsObj} stock_levels The object with all of the stock levels
 */
function saveState(stock_levels) {
  for (const [number, level] of Object.entries(stock_levels)) {
    redisClient.hset('stock_levels', number, level)
  }
}

/** Used to stop unauthenticated clients getting to pages */
function checkAuthenticated(req, res, next) {
  redisClient.sismember('authed_ids', req.session.id, (err, reply) => {
    if (err) handleError("Couldn't check authed_ids from Redis", err)
    if (reply) {
      return next()
    }
    res.redirect('/login')
  })
}

/** Used to stop authenticated clients getting to pages */
function checkNotAuthenticated(req, res, next) {
  redisClient.sismember('authed_ids', req.session.id, (err, reply) => {
    if (err) handleError("Couldn't check authed_ids from Redis", err)
    if (reply) {
      return res.redirect('/')
    }
    next()
  })
}

// ---------------------------------------------------------------------------
// Routes - main
// ---------------------------------------------------------------------------
// Core pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'))
})

app.get('/availability', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/buttons.html'))
})

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/history.html'))
})

app.get('/slideshow', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/slideshow.html'))
})

app.get('/settings', checkAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/settings.html'))
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.get('/downloads', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/downloads.html'))
})

app.get('/bridge', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/bridge.html'))
})

// Other routes
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/misc/robots.txt'))
})

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/misc/manifest.json'))
})

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/misc/sitemap.xml'))
})

app.get('/.well-known/security.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/misc/security.txt'))
})

app.get('/.well-known/keybase.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/misc/keybase.txt'))
})

app.get('/humans.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/misc/humans.txt'))
})

// Routes for slimmed down socket.io (without JSON3, a JSON polyfill for IE6/IE7, and debug)
app.get('/js/socket.io.slim.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/socket.io-client/dist/socket.io.slim.js'))
})
app.get('/js/socket.io.slim.js.map', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/socket.io-client/dist/socket.io.slim.js.map'))
})

// Routes for reveal (the slideshow package)
app.get('/css/reveal.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/dist/reveal.css'))
})
app.get('/css/theme/black.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/dist/theme/black.css'))
})
app.get('/js/reveal.esm.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/dist/reveal.esm.js'))
})
app.get('/js/reveal.esm.js.map', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/dist/reveal.esm.js.map'))
})

app.use(express.static('public'))

// ---------------------------------------------------------------------------
// Routes - authentication
// ---------------------------------------------------------------------------
app.post('/users', (req, res) => {
  // Store the name in the users session
  const name = req.body.name
  const code = req.body.code
  const thisSession = req.session.id

  // Check the code entered
  bcrypt.compare(code, ADMIN_CODE, (err, resp) => {
    if (err) handleError("Couldn't compare codes with bcrypt", err)
    if (resp) {
      console.log(`Client - ${thisSession} - has entered the correct code`)
      req.session.name = name
      redisClient.sadd('authed_ids', thisSession)
      redisClient.smembers(`sock:${thisSession}`, (err, reply) => {
        if (err) handleError("Couldn't get session members from Redis", err)
        for (const socket of reply) {
          io.to(socket).emit('auth', true)
        }
      })
      res.redirect('/')
    } else {
      console.log(`Client - ${thisSession} - has entered the wrong code (${code})`)
      req.flash('error', 'Wrong code, please try again')
      res.redirect('login')
    }
  })
})

app.get('/logout', (req, res) => {
  const thisSession = req.session.id
  redisClient.srem('authed_ids', thisSession)
  redisClient.smembers(`sock:${thisSession}`, (err, reply) => {
    if (err) handleError("Couldn't get session members from Redis", err)
    for (const socket of reply) {
      io.to(socket).emit('auth', false)
    }
  })
  res.redirect('/')
})

// ---------------------------------------------------------------------------
// Routes - API
// ---------------------------------------------------------------------------
app.get('/api/stock_levels', (req, res) => {
  res.send(last_table)
})

app.get('/api/stock_levels/:number', (req, res) => {
  res.send(last_table[req.params.number])
})

app.post('/api/stock_levels', (req, res) => {
  const name = req.session.name || 'API'
  if (ENABLE_API === 'true') {
    if (Object.keys(req.body).length > NUM_OF_BUTTONS) {
      console.log('Too many items in JSON')
      res.status(400).send('Too many items in JSON')
      return
    } else if (Object.keys(req.body).length === NUM_OF_BUTTONS) {
      replaceAll(name, req.body)
    } else {
      // If the number of entries is under NUM_OF_BUTTONS, update the levels one-by-one
      const name = req.session.name || 'API'
      for (const [number, level] of Object.entries(req.body)) {
        updateSingle(name, Number(number), level)
      }
    }
    res.send(last_table)
  } else {
    console.log('API use is not enabled')
    res.status(403).send('API use is not enabled')
  }
})

app.post('/api/stock_levels/:number/:level', (req, res) => {
  const name = req.session.name || 'API'
  const number = Number(req.params.number)
  const level = req.params.level

  if (ENABLE_API === 'true') {
    if (number <= NUM_OF_BUTTONS) {
      updateSingle(name, number, level)
      res.send(last_table)
    } else {
      console.log('Number too high')
      res.status(400).send('Number too high')
    }
  } else {
    console.log('API use is not enabled')
    res.status(403).send('API use is not enabled')
  }
})

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  // Track which sockets are related to each session
  redisClient.sadd(`sock:${socket.handshake.session.id}`, socket.id)

  // Check if the socket belongs to an authorised session
  redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
    if (err) handleError("Couldn't check authed_ids from Redis", err)
    if (reply) {
      io.to(socket.id).emit('auth', true)
    } else {
      io.to(socket.id).emit('auth', false)
    }
  })

  // Find out which path the socket originated from
  let pathname = ''
  const referer = socket.handshake.headers.referrer
  if (referer) {
    pathname = new URL(referer).pathname.slice(1)
  } else {
    // If there is no header information, it's likely originated from a bot
    pathname = 'bot'
  }

  // When a new client connects, update them with the current state of things
  console.log(`Client ${socket.id} connected`)
  console.log('Distributing previous state')
  io.to(socket.id).emit('replace-all', last_table)
  io.to(socket.id).emit('config', last_config)

  /* -------------------------------- */
  /* Path specific actions            */
  /* -------------------------------- */
  if (pathname === 'history' || pathname === 'availability' || pathname === 'bot') {
    // Send information about all of the beers
    // Check if the beers file has already been read in
    if (JSON.stringify(beers) === '{}') {
      console.log('Beers object empty')

      // Check if the beers file exists. If it does, read it in and send it
      fs.access(BEERS_FILE, fs.F_OK, (err) => {
        if (err) {
          console.error('No beers file found')
        } else {
          console.log('Reading in beers file')
          csvToJson()
            .fromFile(BEERS_FILE)
            .then((jsonObj) => {
              beers = jsonObj
              console.log('Sending newly created beers object')
              io.to(socket.id).emit('beers', beers)
            })
        }
      })
    } else {
      // Send a previously generated beers object
      console.debug('Sending beers object')
      io.to(socket.id).emit('beers', beers)
    }
  }

  if (pathname === 'history' || pathname === 'bot') {
    redisClient.zrange('log', 0, -1, (err, reply) => {
      if (err) handleError("Couldn't check get log from Redis", err)

      // Parse each log entry then send them all
      const history = []
      reply.forEach((update) => history.push(JSON.parse(update)))
      io.to(socket.id).emit('history', history)
    })
  }

  /* -------------------------------- */
  /* eventName specific actions       */
  /* -------------------------------- */
  socket.on('update-all', (table) => {
    const name = socket.handshake.session.name
    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        updateRequired(name, table)
      } else {
        console.log(`%Unauthenticated client ${socket.id} attempted to change the matrix with: ${table}`)
        io.to(socket.id).emit('replace-all', last_table)
      }
    })
  })

  socket.on('replace-all', (table) => {
    const name = socket.handshake.session.name
    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        replaceAll(name, table)
      } else {
        console.log(`%Unauthenticated client ${socket.id} attempted to change the matrix with: ${table}`)
        io.to(socket.id).emit('replace-all', last_table)
      }
    })
  })

  socket.on('update-single', (stock_level) => {
    const name = socket.handshake.session.name
    const number = stock_level.number
    const level = stock_level.level

    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        updateSingle(name, number, level)
      } else {
        console.log(`Unauthenticated client ${socket.id} attempted to change ${number} to ${level}`)
        io.to(socket.id).emit('replace-all', last_table)
      }
    })
  })

  socket.on('config', (configuration) => {
    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        // Distribute and save the configuration
        console.log('Distributing configuration:')
        console.log(configuration)
        io.sockets.emit('config', configuration)
        last_config = configuration
        redisClient.hset('config', 'confirm', configuration.confirm)
        redisClient.hset('config', 'low_enable', configuration.low_enable)
      } else {
        console.log(
          `Unauthenticated client ${socket.id} attempted to change the config with: ${JSON.stringify(configuration)}`
        )
        io.to(socket.id).emit('config', last_config)
      }
    })
  })

  socket.on('beers-file', (beersFileText) => {
    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        csvToJson()
          .fromString(beersFileText)
          .then((jsonObj) => {
            beers = jsonObj
            console.log('Sending updated beer information')
            io.sockets.emit('beers', beers)

            fs.writeFile('public/downloads/current-beers.csv', beersFileText, (err) => {
              if (err) {
                return console.log(err)
              }
              console.log('New beer information file saved')
            })
          })
      } else {
        console.log(
          `Unauthenticated client ${socket.id} attempted to change the beer information with: ${beersFileText}`
        )
        io.to(socket.id).emit('config', last_config)
      }
    })
  })

  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected`)
    redisClient.srem(`sock:${socket.handshake.session.id}`, socket.id)
  })
})
