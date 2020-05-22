#!/usr/bin/env node

'use strict'

const http = require('http')
const path = require('path')

const bcrypt = require('bcryptjs')
const csv = require('csvtojson')
const express = require('express')
const express_enforces_ssl = require('express-enforces-ssl')
const flash = require('express-flash')
const helmet = require('helmet')
const session = require('express-session')
const sharedsession = require('express-socket.io-session')
const redis = require('redis')

const ADMIN_CODE = process.env.ADMIN_CODE || ''
const COOKIE_SECRET = process.env.COOKIE_SECRET || '8OarM0c9KnkjM8ucDorbFTU3ssST4VIx'
const ENABLE_API = process.env.ENABLE_API || 'false'
const NODE_ENV = process.env.NODE_ENV || ''
const REDIS_URL = process.env.REDIS_URL || ''
const BEERS_FILE = process.env.BEERS_FILE || './public/downloads/2020-beers.csv'

const app = express()
const server = new http.Server(app)
const io = require('socket.io')(server)
const redisClient = redis.createClient({ url: REDIS_URL })
const RedisStore = require('connect-redis')(session)

/** @type {configObj} */
let last_config = {}

/** @type{stockLevelsObj} */
let last_table = {}

/** @type{beersObj} */
let beers = {}

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
// Security
// ---------------------------------------------------------------------------
app.use(helmet())
app.use(helmet.referrerPolicy({ policy: 'same-origin' }))
app.use(
  helmet.featurePolicy({
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

// Read in beers list CSV file - FIXME
// !WARNING: This is async, need to make sure that this runs before any clients connect!
csv()
  .fromFile(BEERS_FILE)
  .then((jsonObj) => {
    beers = jsonObj
  })

// Set up server
const redisSession = session({
  cookie: { sameSite: 'strict' },
  secret: COOKIE_SECRET,
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: true
})

io.use(sharedsession(redisSession))
app.set('view-engine', 'ejs')
app.enable('trust proxy')

if (NODE_ENV === 'production') app.use(express_enforces_ssl())

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(flash())
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
    for (let i = 1; i <= 80; i++) {
      last_table[i] = 'full'
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
  const day = timeObj.toLocaleDateString('en-GB', { weekday: 'long' })
  let time = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  time = time.replace(' AM', '').replace(' PM', '') // Fix for Heroku - it shouldn't add this?
  const singleUpdateObj = {
    epoch_time: epochTime,
    day: day,
    time: time,
    name: name,
    number: number,
    level: level
  }
  redisClient.zadd('log', `${epochTime}`, JSON.stringify(singleUpdateObj))
  console.log(`Distibuting updates from ${name} (number ${number} = ${level})`)
  if (last_table[number] !== level) {
    last_table[number] = level
    io.sockets.emit('update single', singleUpdateObj)
    saveState(last_table)
  }
}

/**
 * This takes in a {@link stockLevelsObj} and emits it to all connected clients
 * @param {string} name The nameof the user
 * @param {stockLevelsObj} stock_levels The object with all of the stock levels
 */
function updateAll(name, stock_levels) {
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
  console.log(`Distibuting whole table from ${name}`)
  last_table = stock_levels
  io.sockets.emit('update table', stock_levels)
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

// Routes for reveal (the slideshow package)
app.get('/css/reset.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/css/reset.css'))
})
app.get('/css/reveal.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/css/reveal.css'))
})
app.get('/css/theme/black.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/css/theme/black.css'))
})
app.get('/js/reveal.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/js/reveal.js'))
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
      redisClient.smembers(thisSession, (err, reply) => {
        if (err) handleError("Couldn't get session members from Redis", err)
        for (const socket of reply) {
          io.to(`${socket}`).emit('auth', true)
        }
      })
      res.redirect('/')
    } else {
      console.log(`Client - ${thisSession} - has enterted the wrong code (${code})`)
      req.flash('error', 'Wrong code, please try again')
      res.redirect('login')
    }
  })
})

app.get('/logout', (req, res) => {
  const thisSession = req.session.id
  redisClient.srem('authed_ids', thisSession)
  redisClient.smembers(thisSession, (err, reply) => {
    if (err) handleError("Couldn't get session members from Redis", err)
    for (const socket of reply) {
      io.to(`${socket}`).emit('auth', false)
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
    if (Object.keys(req.body).length > 80) {
      console.log('Too many items in JSON')
      res.status(400).send('Too many items in JSON')
      return
    } else if (Object.keys(req.body).length === 80) {
      updateAll(name, req.body)
    } else {
      // If the number of entries is under 80, update the levels one-by-one
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
    if (number <= 80) {
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
  const pathname = new URL(socket.handshake.headers.referer).pathname.slice(1)

  // When a new client connects, update them with the current state of things
  console.log(`Client ${socket.id} connected`)
  console.log('Distibuting previous state')
  io.to(`${socket.id}`).emit('update table', last_table)
  io.to(`${socket.id}`).emit('config', last_config)

  if (pathname === 'history' || pathname === 'availability') {
    if (JSON.stringify(beers) === '{}') console.error('Client sent empty beers list')
    io.to(`${socket.id}`).emit('beers', beers)
  }

  if (pathname === 'history') {
    redisClient.zrange('log', 0, -1, (err, reply) => {
      if (err) handleError("Couldn't check get log from Redis", err)
      const history = []
      reply.forEach((update) => history.push(JSON.parse(update)))
      io.to(`${socket.id}`).emit('update history', history)
    })
  }

  redisClient.sadd(socket.handshake.session.id, socket.id)

  redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
    if (err) handleError("Couldn't check authed_ids from Redis", err)
    if (reply) {
      io.to(`${socket.id}`).emit('auth', true)
    } else {
      io.to(`${socket.id}`).emit('auth', false)
    }
  })

  socket.on('update table', (table) => {
    const name = socket.handshake.session.name
    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        updateAll(name, table)
      } else {
        console.log(`%Unauthenticated client ${socket.id} attempted to change the matrix with: ${table}`)
        io.to(`${socket.id}`).emit('update table', last_table)
      }
    })
  })

  socket.on('update single', (stock_level) => {
    const name = socket.handshake.session.name
    const number = stock_level.number
    const level = stock_level.level

    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        updateSingle(name, number, level)
      } else {
        console.log(`Unauthenticated client ${socket.id} attempted to change ${number} to ${level}`)
        io.to(`${socket.id}`).emit('update table', last_table)
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
        io.to(`${socket.id}`).emit('config', last_config)
      }
    })
  })

  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected`)
    redisClient.srem(socket.handshake.session.id, socket.id)
  })
})
