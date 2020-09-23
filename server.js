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
const cors = require('cors')
const express = require('express')
const expressEnforcesSsl = require('express-enforces-ssl')
const expressFlash = require('express-flash')
const expressSocketIoSession = require('express-socket.io-session')
const featurePolicy = require('feature-policy')
const helmet = require('helmet')
const session = require('express-session')

// Other packages
const bcrypt = require('bcryptjs')
const csvParse = require('csv-parse/lib/sync')
const csvStringify = require('csv-stringify/lib/sync')
const fetch = require('node-fetch')
const redis = require('redis')
const socketIo = require('socket.io')
const WBK = require('wikibase-sdk')

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
const BEERS_FILE = process.env.BEERS_FILE || ''
const CURRENT_BEERS_FILE = './public/downloads/current-beers.csv'

/** @type {configObj} */
const last_config = { confirm: true, low_enable: false }

/** @type{stockLevelsObj} */
let last_table = {}

/** @type{beersObj} */
let beers = null

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

const wdk = WBK({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql'
})

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
      // ambientLightSensor: ["'none'"], // Chrome doesn't like this at the moment
      camera: ["'none'"],
      geolocation: ["'none'"],
      gyroscope: ["'none'"],
      magnetometer: ["'none'"],
      microphone: ["'none'"],
      // serial: ["'none'"], // Chrome doesn't like this at the moment
      usb: ["'none'"]
    }
  })
)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      baseUri: ["'none'"],
      defaultSrc: ["'none'"],
      connectSrc: ["'self'", 'ws:'],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      // frameAncestors: ["'self'"], // Comment out to allow embedding as an iframe elsewhere
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

app.use((req, res, next) => {
  // Only cache resources if:
  //   * They are requested via a GET
  //   * The URL is not in the `disableForURLs` list
  //   * It is not a request for an API endpoint
  const disableForURLs = ['/login', '/logout', '/settings']
  const apiURL = '/api/'

  if (req.method === 'GET' && !disableForURLs.includes(req.url) && !req.url.includes(apiURL)) {
    // console.log('+++++++++++++++++++++++++++ setting cache for', req.url)
    res.set('Cache-control', 'public, must-revalidate')
  } else {
    // console.log('--------------------------- disable cache for', req.url)
    res.set('Cache-control', 'no-store')
  }

  next()
})

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
    // Convert the true/false strings to bools, then store them
    last_config.confirm = reply.confirm === 'true'
    last_config.low_enable = reply.low_enable === 'true'
  } else {
    console.log('No configuration settings defined in Redis, using defaults')
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
  // Save the whole table at once
  console.log(`Distributing whole table from "${name}", backing up and wiping log`)

  // Before replacing all, perform backups and set them to expire in a week
  const epochTime = Date.now()
  const logBackupName = `backup:log:${epochTime}`
  const stockBackupName = `backup:stock_levels:${epochTime}`
  const allBackupName = 'backup:all'

  redisClient.exists('log', (err, reply) => {
    // Backup log if it exists by renaming it
    if (err) handleError("Couldn't check if log exists with Redis", err)
    if (reply) redisClient.rename('log', logBackupName)

    // Backup the current state
    for (const [number, level] of Object.entries(last_table)) redisClient.hset(stockBackupName, number, level)

    // Add to the list of backups
    redisClient.sadd(allBackupName, epochTime)

    // Finally, replace the state and send it off
    last_table = stock_levels
    saveState(stock_levels)
    io.sockets.emit('replace-all', stock_levels)
  })
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

/**
 * Save the beers list to a CSV file
 * @param {beersObj} beers The object containing information on each beer
 */
function saveCSV(beers) {
  // Generate CSV from the beers list
  const columns = [
    'beer_number',
    'beer_name',
    'brewer',
    'brewery_wikidata_id',
    'abv',
    'beer_style',
    'vegan',
    'gluten_free',
    'description',
    'brewery_website',
    'brewery_beer_advocate',
    'brewery_rate_beer',
    'brewery_untappd',
    'brewery_facebook',
    'brewery_instagram',
    'brewery_twitter'
  ]

  const csvStr = csvStringify(Object.values(beers), { header: true, columns: columns })

  fs.writeFile(CURRENT_BEERS_FILE, csvStr, (err) => {
    if (err) throw err
  })
}

/**
 * Save the beers list to redis
 * @param {beersObj} beers The object containing information on each beer
 */
function saveBeers(beers) {
  redisClient.del('beers', (err, reply) => {
    if (err) handleError("Couldn't delete beers list from Redis", err)

    Object.entries(beers).forEach(([beerId, beer]) => {
      redisClient.hset('beers', beerId, JSON.stringify(beer))
    })
  })
}

/**
 * Get a list of all of the Wikidata QIDs for the breweries in {@link beers}
 * @param {beersObj} beers The object containing information on each beer
 * @returns {Array} A list of all of the unique brewery QIDs found in 'beers`
 */
function getBreweryIds(beers) {
  const brewery_wikidata_ids = []

  // For each beer in `beers`, get the Wikidata QID
  Object.values(beers).forEach((beer) => {
    const brewery_wikidata_id = beer.brewery_wikidata_id

    // Only add it to the list if it exists and is unique
    if (brewery_wikidata_id && !brewery_wikidata_ids.includes(brewery_wikidata_id)) {
      brewery_wikidata_ids.push(brewery_wikidata_id)
    }
  })
  return brewery_wikidata_ids
}

/**
 * Gets information about the breweries from Wikidata
 * @param {Array} brewery_wikidata_ids A list of QIDs that point to breweries on Wikidata
 * @returns {Promise} Returns a list of objects with info about the breweries
 */
function getBreweryInfo(brewery_wikidata_ids) {
  return new Promise((resolve, reject) => {
    if (brewery_wikidata_ids.length <= 0) return reject('No IDs to get Wikidata claims for')
    console.log(`Retrieving Wikidata claims for ${brewery_wikidata_ids.length} breweries: ${brewery_wikidata_ids}`)

    // Get the URLs for the queries that we're after
    const urls = wdk.getManyEntities({
      ids: brewery_wikidata_ids,
      languages: ['en'],
      props: ['claims']
    })

    // Keep track of the URLs that have been worked on
    const done_urls = []

    // Store all of the claims here
    const wikidata_claims = {}

    urls.forEach((url) => {
      fetch(url)
        .then((response) => response.json())
        .then(wdk.parse.wd.entities)
        .then((entities) => {
          // Pick out the data we want and add it to `wikidata_claims`
          Object.keys(entities).forEach((entity) => {
            const qid = entities[entity].id
            const website = entities[entity].claims?.P856?.[0] || ''

            const beerAdvocateId = entities[entity].claims?.P2904?.[0]
            const rateBeerId = entities[entity].claims?.P2905?.[0]
            const untappdId = entities[entity].claims?.P3002?.[0]
            const facebookId = entities[entity].claims?.P2013?.[0]
            const instagramId = entities[entity].claims?.P2003?.[0]
            const twitterId = entities[entity].claims?.P2002?.[0]

            const beerAdvocate = beerAdvocateId ? `https://www.beeradvocate.com/beer/profile/${beerAdvocateId}/` : ''
            const rateBeer = rateBeerId ? `https://www.ratebeer.com/brewers/${rateBeerId}/` : ''
            const untappd = untappdId ? `https://untappd.com/brewery/${untappdId}/` : ''
            const facebook = facebookId ? `https://www.facebook.com/${facebookId}/` : ''
            const instagram = instagramId ? `https://www.instagram.com/${instagramId}/` : ''
            const twitter = twitterId ? `https://twitter.com/${twitterId}/` : ''

            wikidata_claims[qid] = {
              brewery_website: website,
              brewery_beer_advocate: beerAdvocate,
              brewery_rate_beer: rateBeer,
              brewery_untappd: untappd,
              brewery_facebook: facebook,
              brewery_instagram: instagram,
              brewery_twitter: twitter
            }
          })
        })
        .then(() => {
          done_urls.push(url)

          // After all of the URLs have been taken care of...
          if (urls.length === done_urls.length) {
            resolve(wikidata_claims)
          }
        })
        .catch((error) => {
          if (error.name === 'FetchError') {
            reject(new Error("Couldn't connect to Wikidata"))
          } else {
            reject(error)
          }
        })
    })
  })
}

/**
 * Downloads info from Wikidata and adds the information to the list of beers
 * @param {beersObj} beers The object containing information on each beer
 * @returns {Promise} The list containing all of the beer objects (`beers`), but with added info from Wikidata
 */
function updateBeersFromWikidata(beers) {
  return new Promise((resolve, reject) => {
    const brewery_wikidata_ids = getBreweryIds(beers)
    getBreweryInfo(brewery_wikidata_ids)
      .then((brewery_wikidata_claims) => {
        const wikidata_beers = {}

        Object.entries(beers).forEach(([beerId, beer]) => {
          if (Object.keys(brewery_wikidata_claims).includes(beer.brewery_wikidata_id)) {
            // Merge beer object with Wikidata claims object
            wikidata_beers[beerId] = { ...beer, ...brewery_wikidata_claims[beer.brewery_wikidata_id] }
          } else {
            wikidata_beers[beerId] = beer
          }
        })
        resolve(wikidata_beers)
      })
      .catch((error) => {
        reject(error)
      })
  })
}

/**
 * Initialises the {@link beers} array and manages the saving of the `CURRENT_BEERS_FILE`
 * The order that this will check the existence of, and then use is:
 * Redis -> CURRENT_BEERS_FILE -> BEERS_FILE -> generated empty file
 * After reading the beers in, they will be saved in Redis and `CURRENT_BEERS_FILE`
 * @returns {Promise} When the beers array has been initialised
 */
function initialiseBeers() {
  return new Promise((resolve, reject) => {
    // Check if the beers file has already been read in
    if (beers === null) {
      console.log('Beer information does not exist yet')

      redisClient.hgetall('beers', (err, reply) => {
        if (err) {
          reject()
          handleError("Couldn't beers list from Redis", err)
        }

        if (reply === null) {
          // Check that the current beers file exists
          try {
            fs.accessSync(CURRENT_BEERS_FILE, fs.F_OK)
          } catch (err) {
            try {
              console.error(`No current beers file found, trying default (${BEERS_FILE})`)
              fs.accessSync(BEERS_FILE, fs.F_OK)
              fs.copyFileSync(BEERS_FILE, CURRENT_BEERS_FILE)
            } catch (err) {
              console.error('No current or default beers files found, making a blank one to use instead')
              fs.closeSync(fs.openSync(CURRENT_BEERS_FILE, 'w'))
            }
          }
          console.log('Reading in current beers file')
          beers = {}
          csvParse(fs.readFileSync(CURRENT_BEERS_FILE), { columns: true }).forEach((beer) => {
            beers[beer.beer_number] = beer
          })

          console.log('Saving beer information to Redis')
          saveBeers(beers)

          console.log('Resolving newly created beers list')
          resolve()
        } else {
          // For every beer, parse the entry then add it to the beers object
          beers = {}
          for (const beerStr in reply) {
            const beer = JSON.parse(reply[beerStr])
            beers[beer.beer_number] = beer
          }

          console.log('Saving CSV from Redis')
          saveCSV(beers)

          console.log('Resolving beers from Redis')
          resolve()
        }
      })
    } else {
      resolve()
    }
  })
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
  // Remove the X-Frame-Options header so that this page can be embedded (iframe)
  res.removeHeader('X-Frame-Options')
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
  // Initialise the beer information so that `CURRENT_BEERS_FILE` is available
  initialiseBeers().then(() => {
    res.sendFile(path.join(__dirname, 'views/downloads.html'))
  })
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
app.get('/css/theme/reveal-custom.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/reveal-custom.css'))
})
app.get('/js/reveal.esm.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/dist/reveal.esm.js'))
})
app.get('/js/reveal.esm.js.map', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/reveal.js/dist/reveal.esm.js.map'))
})

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
app.get('/api/beers', cors(), (req, res) => {
  initialiseBeers().then(() => {
    res.send(beers)
  })
})

app.get('/api/stock_levels', cors(), (req, res) => {
  res.send(last_table)
})

app.get('/api/stock_levels/:number', cors(), (req, res) => {
  res.send(last_table[req.params.number])
})

app.post('/api/stock_levels', cors(), (req, res) => {
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

app.post('/api/stock_levels/:number/:level', cors(), (req, res) => {
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
// Routes - others
// ---------------------------------------------------------------------------
// Public files
app.use(express.static('public'))

// Handle 404
app.use(function (req, res) {
  res.status(404).sendFile(path.join(__dirname, 'views/misc/404.html'))
})

// Handle 500
app.use(function (error, req, res, next) {
  res.status(500).sendFile(path.join(__dirname, 'views/misc/500.html'))
  console.log('Server error:', error)
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
  const referrer = socket.handshake.query.source

  if (referrer) {
    pathname = referrer.slice(1)
  } else {
    // If there is no header information, it's likely originated from a bot
    pathname = 'bot'
  }

  if (pathname === '') pathname = 'index'
  if (pathname.slice(-1) === '/') pathname = pathname.slice(0, -1)

  // When a new client connects, update them with the current state of things
  console.log(`Client ${socket.id} connected (${pathname})`)

  // Send the configuration settings
  if (pathname === 'settings' || pathname === 'availability' || pathname === 'bot') {
    io.to(socket.id).emit('config', last_config)
  }

  // Send the beer information
  if (pathname === 'history' || pathname === 'availability' || pathname === 'bot') {
    initialiseBeers().then(() => {
      io.to(socket.id).emit('beers', beers)
    })
  }

  // Send the current state of all of the beers
  if (pathname !== 'history') {
    io.to(socket.id).emit('replace-all', last_table)
  }

  // Send the log of the previous states of all of the beers
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
        last_config.confirm = configuration.confirm
        last_config.low_enable = configuration.low_enable
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
    console.log('New beers file received from', socket.handshake.session.id)

    redisClient.sismember('authed_ids', socket.handshake.session.id, (err, reply) => {
      if (err) handleError("Couldn't check authed_ids from Redis", err)
      if (reply) {
        beers = {}
        csvParse(beersFileText, { columns: true }).forEach((beer) => {
          beers[beer.beer_number] = beer
        })

        updateBeersFromWikidata(beers)
          .then((wikidata_beers) => {
            console.log('Storing Wikidata claims')
            beers = wikidata_beers
          })
          .catch((error) => {
            console.log(error)
          })
          .finally(() => {
            console.log('Sending updated beer information')
            io.sockets.emit('beers', beers)

            console.log('Saving new beer information CSV')
            saveCSV(beers)

            console.log('Saving beer information to Redis')
            saveBeers(beers)
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
