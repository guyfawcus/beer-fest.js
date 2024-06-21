#!/usr/bin/env node

// Built in packages
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'

// Express related packages
import compression from 'compression'
import RedisStore from 'connect-redis'
import cors from 'cors'
import express from 'express'
import expressEnforcesSsl from 'express-enforces-ssl'
import expressFlash from 'express-flash'
import expressSocketIoSession from 'express-socket.io-session'
import featurePolicy from 'feature-policy'
import helmet from 'helmet'
import session from 'express-session'

// Other packages
import bcrypt from 'bcryptjs'
import { parse as csvParse } from 'csv-parse/sync'
import { stringify as csvStringify } from 'csv-stringify/sync'
import GeoJSON from 'geojson'
import pino from 'pino'
import redis from 'redis'
import { Server as SocketIo } from 'socket.io'
import { WBK, simplifySparqlResults } from 'wikibase-sdk'

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'pid,hostname'
    }
  },
  level: process.env.LOG_LEVEL || 'info'
})

// ---------------------------------------------------------------------------
// Variable definitions
// ---------------------------------------------------------------------------
const TEMP_UNHASHED = crypto.randomBytes(24).toString('hex')
const ADMIN_CODE = process.env.ADMIN_CODE || bcrypt.hashSync(TEMP_UNHASHED, 10)
const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(64).toString('hex')

if (!process.env.ADMIN_CODE) {
  logger.warn(
    '\x1b[33m%s\x1b[0m',
    `To be able to log in easily, please generate a secure $ADMIN_CODE environment variable using utils/codegen.js
For the moment though, you can log in with "${TEMP_UNHASHED}"\n`
  )
}

if (!process.env.COOKIE_SECRET) {
  logger.warn(
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
const NUM_OF_BUTTONS = 88

/** This url contains a Wikidata query for information about the breweries with QIDs
 * It is updated on start and when a new beers file is uploaded. */
let brewery_query_url = 'https://query.wikidata.org/'

/** This will contain the GeoJSON that describes all of the breweries
 * It is updated on start and when a new beers file is uploaded. */
let brewery_geojson = ''

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
/**
 * Object to store the configuration state
 * @typedef {object} configObj
 * @property {boolean} confirm
 * @property {boolean} low_enable
 */

/** @typedef {import('./public/js/core.js').stockLevelsObj} stockLevelsObj */
/** @typedef {import('./public/js/core.js').beersObj} beersObj */
/** @typedef {import('./public/js/core.js').levelValues} levelValues */

// ---------------------------------------------------------------------------
// Initial setup
// ---------------------------------------------------------------------------
const app = express()

const tls_config =
  NODE_ENV === 'production' ? { rejectUnauthorized: false, requestCert: true, agent: false } : undefined
const redisClient = redis.createClient({ url: REDIS_URL, tls: tls_config })

await redisClient.connect()

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
      imgSrc: ["'self'", '*.tile.openstreetmap.org', 'data:'],
      manifestSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      reportUri: '/report-violation',
      upgradeInsecureRequests: null
    }
  })
)

const cspParser = express.json({
  type: ['json', 'application/csp-report']
})

app.post('/report-violation', cspParser, (req, res) => {
  const srcFile = (req.body['csp-report'] && req.body['csp-report']['source-file']) || ''
  const blockedUri = (req.body['csp-report'] && req.body['csp-report']['blocked-uri']) || ''

  if (srcFile.includes('onloadwff.js')) {
    logger.debug('CSP Violation: onloadwff.js error, this might be a LastPass thing')
    res.status(204).end()
    return
  }

  if (blockedUri === 'data') {
    logger.debug('CSP Violation: data URI error, this might be a NoScript thing')
    res.status(204).end()
    return
  }

  if (blockedUri.substr(0, 4) === 'wss:') {
    logger.debug('Websocket transport issue: wss')
    res.status(204).end()
    return
  }

  if (req.body) {
    logger.debug(`CSP Violation: ${JSON.stringify(req.body)}`)
  } else {
    logger.debug('CSP Violation: No data received!')
  }
  res.status(204).end()
})

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// Set up server
const server = new http.Server(app)
const io = new SocketIo(server, { cookie: false, serveClient: false })
const redisSession = session(sessionOptions)

io.use(expressSocketIoSession(redisSession))
app.set('view-engine', 'ejs')

app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(expressFlash())
app.use(redisSession)

/* app.use((req, res, next) => {
  // Only cache resources if:
  //   * They are requested via a GET
  //   * The URL is not in the `disableForURLs` list
  //   * It is not a request for an API endpoint
  const disableForURLs = ['/login', '/logout', '/settings', '/brewery-wikidata-query']
  const apiURL = '/api/'

  if (req.method === 'GET' && !disableForURLs.includes(req.url) && !req.url.includes(apiURL)) {
    // logger.debug(`+++++++++++++++++++++++++++ setting cache for ${req.url}`)
    res.set('Cache-control', 'public, must-revalidate')
  } else {
    // logger.debug(`--------------------------- disable cache for ${req.url}`)
    res.set('Cache-control', 'no-store')
  }

  next()
}) */

// Start the server
server.listen(process.env.PORT || 8000, () => {
  logger.info(`Listening on port ${server.address().port}`)
})

// Read in previous state if it exists, initialise all as full if not
await redisClient
  .HGETALL('stock_levels')
  .catch((error) => {
    handleError("Couldn't get stock levels from Redis", error)
  })
  .then((reply) => {
    if (Object.keys(reply).length !== 0) {
      logger.info(`Reading in: ${JSON.stringify(reply)}`)
      last_table = reply
    } else {
      logger.info('Starting off state matrix')
      for (let number = 1; number <= NUM_OF_BUTTONS; number++) {
        last_table[number] = 'full'
      }
      saveState(last_table)
    }
  })

// Read in previous config settings, initialise with defaults if not
await redisClient
  .HGETALL('config')
  .catch((error) => {
    handleError("Couldn't get config from Redis", error)
  })
  .then((reply) => {
    if (Object.keys(reply).length !== 0) {
      logger.info(`Reading in: ${JSON.stringify(reply)}`)
      // Convert the true/false strings to bools, then store them
      last_config.confirm = reply.confirm === 'true'
      last_config.low_enable = reply.low_enable === 'true'
    } else {
      logger.warn('No configuration settings defined in Redis, using defaults')
    }
    redisClient.HSET('config', 'confirm', last_config.confirm.toString())
    redisClient.HSET('config', 'low_enable', last_config.low_enable.toString())
  })

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
redisClient.on('error', (error) => {
  if (error.code === 'ECONNREFUSED') {
    logger.error("Can't connect to Redis")
  } else {
    logger.error(error.message)
  }
  process.exit(1)
})

function handleError(message, error) {
  logger.error(`${message} - ${error.message}`)
  process.exit(1)
}

process.once('SIGINT', () => gracefulShutdown())
process.once('SIGQUIT', () => gracefulShutdown())
process.once('SIGTERM', () => gracefulShutdown())
process.once('SIGUSR2', () => gracefulShutdown())

const gracefulShutdown = () => {
  logger.warn('Shutting down server')

  // Clean up old session-socket mapping(s), new mappings will be created on restart
  redisClient
    .KEYS('sock:*')
    .catch((error) => {
      handleError("Couldn't get socket mappings from Redis", error)
    })
    .then((reply) => {
      if (reply.length === 0) process.exit()

      redisClient
        .DEL(reply)
        .catch((error) => {
          handleError("Couldn't delete socket mappings from Redis", error)
        })
        .then((reply) => {
          logger.info(`Removed ${reply} session-socket mapping(s)`)

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
  redisClient.ZADD('log', { score: epochTime, value: JSON.stringify(singleUpdateObj) })
  logger.info(`Distributing updates from ${name} (number ${number} = ${level})`)
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
  logger.info(`Distributing whole table from "${name}", backing up and wiping log`)

  // Before replacing all, perform backups and set them to expire in a week
  const epochTime = String(Date.now())
  const logBackupName = `backup:log:${epochTime}`
  const stockBackupName = `backup:stock_levels:${epochTime}`
  const allBackupName = 'backup:all'

  redisClient
    .EXISTS('log')
    .catch((error) => {
      handleError("Couldn't check if log exists with Redis", error)
    })
    .then((reply) => {
      // Backup log if it exists by renaming it
      if (reply) redisClient.RENAME('log', logBackupName)

      // Backup the current state
      for (const [number, level] of Object.entries(last_table)) redisClient.HSET(stockBackupName, number, level)

      // Add to the list of backups
      redisClient.SADD(allBackupName, epochTime)

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
    redisClient.HSET('stock_levels', number, level)
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
    'brewery_latitude',
    'brewery_longitude',
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
  redisClient
    .DEL('beers')
    .catch((error) => {
      handleError("Couldn't delete beers list from Redis", error)
    })
    .then((reply) => {
      Object.entries(beers).forEach(([beerId, beer]) => {
        redisClient.HSET('beers', beerId, JSON.stringify(beer))
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
 * @param {String} brewery_query_url Wikidata query URL that gets information about the breweries
 * @returns {Promise} Returns a list of objects with info about the breweries
 */
async function getBreweryInfo(brewery_query_url) {
  // Use a POST request because the URL could be too long for a GET
  const [query_url, query_body] = brewery_query_url.split('?')
  const brewery_query = await fetch(query_url, {
    method: 'POST',
    headers: {
      'User-Agent': 'beer-fest.js (https://github.com/guyfawcus)',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: query_body
  }).catch((error) => {
    throw new Error("Couldn't connect to Wikidata", error)
  })

  const verbose_brewery_query_data = await brewery_query.json()
  const brewery_query_data = simplifySparqlResults(verbose_brewery_query_data)

  const wikidata_claims = {}

  brewery_query_data.forEach((entity) => {
    const qid = entity.brewery.value
    const location = entity.location.match(/(-*\d+\.\d+) (-*\d+\.\d+)/)

    wikidata_claims[qid] = {
      brewery_website: entity.website,
      brewery_latitude: location ? location[2] : '',
      brewery_longitude: location ? location[1] : '',
      brewery_beer_advocate: entity.beerAdvocateUrl,
      brewery_rate_beer: entity.rateBeerUrl,
      brewery_untappd: entity.untappdUrl,
      brewery_facebook: entity.facebookUrl,
      brewery_instagram: entity.instagramUrl,
      brewery_twitter: entity.twitterUrl
    }
  })

  return wikidata_claims
}

/**
 * Downloads info from Wikidata and adds the information to the list of beers
 * @param {beersObj} beers The object containing information on each beer
 * @returns {Promise} The list containing all of the beer objects (`beers`), but with added info from Wikidata
 */
function updateBeersFromWikidata(beers) {
  return new Promise((resolve, reject) => {
    const brewery_query_url = generateBreweryQuery(beers)

    const brewery_wikidata_ids = getBreweryIds(beers)
    if (brewery_wikidata_ids.length <= 0) return reject('No IDs to get Wikidata claims for')
    logger.info(`Retrieving Wikidata claims for ${brewery_wikidata_ids.length} breweries: ${brewery_wikidata_ids}`)

    getBreweryInfo(brewery_query_url)
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
 * Updates {@link brewery_query_url} with a URL that contains a Wikidata query,
 * this query is only for information about the breweries that have Wikidata QIDs.
 * @param {beersObj} beers The object containing information on each beer
 * @returns {string} The URL containing the query for brewery information
 */
function generateBreweryQuery(beers) {
  // Append 'wd:' to each QID then join the list with spaces for use in the query
  const formatted_ids = getBreweryIds(beers)
    .map((qid) => `wd:${qid}`)
    .join(' ')

  const sparql = `# Brewery information
SELECT ?brewery ?breweryLabel ?website ?location ?beerAdvocateUrl ?rateBeerUrl ?untappdUrl ?facebookUrl ?instagramUrl ?twitterUrl

WHERE
  {
    VALUES ?brewery {
      ${formatted_ids}
    }

    OPTIONAL {?brewery wdt:P856 ?website .}

    # Use the headquarters location by default but use the coordinate location as a fallback
    OPTIONAL {?brewery p:P159/pq:P625 ?hq_location .}
    OPTIONAL {?brewery wdt:P625 ?coord_location .}
    BIND(IF(BOUND(?hq_location), ?hq_location, ?coord_location) AS ?location) .

    OPTIONAL {?brewery wdt:P2904 ?beerAdvocateId .}
    OPTIONAL {?brewery wdt:P2905 ?rateBeerId .}
    OPTIONAL {?brewery wdt:P3002 ?untappdId .}
    OPTIONAL {?brewery wdt:P2013 ?facebookId .}
    OPTIONAL {?brewery wdt:P2003 ?instagramId .}
    OPTIONAL {?brewery wdt:P2002 ?twitterId .}

    wd:P2904 wdt:P1630 ?beerAdvocateFormatter .
    wd:P2905 wdt:P1630 ?rateBeerFormatter .
    wd:P3002 wdt:P1630 ?untappdFormatter .
    wd:P2013 wdt:P1630 ?facebookFormatter .
    wd:P2003 wdt:P1630 ?instagramFormatter .
    wd:P2002 wdt:P1630 ?twitterFormatter .

    BIND(IRI(REPLACE(?beerAdvocateId, '^(.+)$', ?beerAdvocateFormatter)) AS ?beerAdvocateUrl) .
    BIND(IRI(REPLACE(?rateBeerId, '^(.+)$', ?rateBeerFormatter)) AS ?rateBeerUrl) .
    BIND(IRI(REPLACE(?untappdId, '^(.+)$', ?untappdFormatter)) AS ?untappdUrl) .
    BIND(IRI(REPLACE(?facebookId, '^(.+)$', ?facebookFormatter)) AS ?facebookUrl) .
    BIND(IRI(REPLACE(?instagramId, '^(.+)$', ?instagramFormatter)) AS ?instagramUrl) .
    BIND(IRI(REPLACE(?twitterId, '^(.+)$', ?twitterFormatter)) AS ?twitterUrl) .

    SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
}

ORDER BY (fn:lower-case(str(?breweryLabel)))
`

  return wdk.sparqlQuery(sparql)
}

/**
 * Updates {@link brewery_geojson}
 * this will only return points for breweries that have Wikidata QIDs and locations in Wikidata.
 * @param {beersObj} beers The object containing information on each beer
 * @returns {string} GeoJSON containing the brewery locations and related information
 */
function generateBreweryGeojson(beers) {
  const data = {}

  Object.values(beers).forEach((beer) => {
    const qid = beer.brewery_wikidata_id

    // Only process the entry if it has a Wikidata QID
    if (qid) {
      // Only process the entry if it has location data to avoid putting it on Null Island
      if (beer.brewery_latitude !== '' && beer.brewery_longitude !== '') {
        // If this is the first time coming across this brewery...
        if (!data[qid]) {
          data[qid] = {}
          data[qid].name = beer.brewer
          data[qid].latitude = beer.brewery_latitude
          data[qid].longitude = beer.brewery_longitude

          data[qid].wikidata_qid = qid
          data[qid].wikidata_url = `http://www.wikidata.org/entity/${qid}`

          data[qid].website = beer.brewery_website
          data[qid].beer_advocate = beer.brewery_beer_advocate
          data[qid].rate_beer = beer.brewery_rate_beer
          data[qid].untappd = beer.brewery_untappd
          data[qid].facebook = beer.brewery_facebook
          data[qid].instagram = beer.brewery_instagram
          data[qid].twitter = beer.brewery_twitter

          data[qid].num_of_beers = 1
          data[qid].has_vegan_beers = beer.vegan === 'y'
          data[qid].has_gluten_free_beers = beer.gluten_free === 'y'
          data[qid].beers = [
            {
              number: beer.beer_number,
              name: beer.beer_name,
              abv: beer.abv,
              style: beer.beer_style,
              vegan: beer.vegan,
              gluten_free: beer.gluten_free,
              description: beer.description
            }
          ]
        } else {
          // If this brewery is already in `data`...
          data[qid].num_of_beers++
          data[qid].has_vegan_beers = data[qid].has_vegan_beers || beer.vegan === 'y'
          data[qid].has_gluten_free_beers = data[qid].has_gluten_free_beers || beer.gluten_free === 'y'
          data[qid].beers.push({
            number: beer.beer_number,
            name: beer.beer_name,
            abv: beer.abv,
            style: beer.beer_style,
            vegan: beer.vegan,
            gluten_free: beer.gluten_free,
            description: beer.description
          })
        }
      }
    }
  })

  const geojson = GeoJSON.parse(Object.values(data), { Point: ['latitude', 'longitude'] })
  return geojson
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
      logger.warn('Beer information does not exist yet')

      redisClient
        .HGETALL('beers')
        .catch((error) => {
          reject()
          handleError("Couldn't get the beers list from Redis", error)
        })
        .then((reply) => {
          if (reply === null) {
            // Check that the current beers file exists
            try {
              fs.accessSync(CURRENT_BEERS_FILE, fs.constants.F_OK)
            } catch (err) {
              try {
                logger.warn(`No current beers file found, trying default (${BEERS_FILE})`)
                fs.accessSync(BEERS_FILE, fs.constants.F_OK)
                fs.copyFileSync(BEERS_FILE, CURRENT_BEERS_FILE)
              } catch (err) {
                logger.warn('No current or default beers files found, making a blank one to use instead')
                fs.closeSync(fs.openSync(CURRENT_BEERS_FILE, 'w'))
              }
            }
            logger.info('Reading in current beers file')
            beers = {}
            csvParse(fs.readFileSync(CURRENT_BEERS_FILE), { columns: true }).forEach((beer) => {
              beers[beer.beer_number] = beer
            })

            logger.info('Saving beer information to Redis')
            saveBeers(beers)

            logger.info('Updating brewery query URL and GeoJSON')
            brewery_query_url = generateBreweryQuery(beers)
            brewery_geojson = generateBreweryGeojson(beers)

            resolve()
          } else {
            // For every beer, parse the entry then add it to the beers object
            beers = {}
            for (const beerStr in reply) {
              const beer = JSON.parse(reply[beerStr])
              beers[beer.beer_number] = beer
            }

            logger.info('Saving CSV from Redis')
            saveCSV(beers)

            logger.info('Updating brewery query URL and GeoJSON')
            brewery_query_url = generateBreweryQuery(beers)
            brewery_geojson = generateBreweryGeojson(beers)

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
  redisClient
    .SISMEMBER('authed_ids', req.session.id)
    .catch((error) => {
      handleError("Couldn't check authed_ids from Redis", error)
    })
    .then((reply) => {
      if (reply) {
        return next()
      }
      res.redirect('/login')
    })
}

/** Used to stop authenticated clients getting to pages */
function checkNotAuthenticated(req, res, next) {
  redisClient
    .SISMEMBER('authed_ids', req.session.id)
    .catch((error) => {
      handleError("Couldn't check authed_ids from Redis", error)
    })
    .then((reply) => {
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
  res.sendFile('views/index.html', { root: import.meta.dirname })
})

app.get('/availability', (req, res) => {
  // Remove the X-Frame-Options header so that this page can be embedded (iframe)
  res.removeHeader('X-Frame-Options')
  res.sendFile('views/buttons.html', { root: import.meta.dirname })
})

app.get('/history', (req, res) => {
  res.sendFile('views/history.html', { root: import.meta.dirname })
})

app.get('/slideshow', (req, res) => {
  res.sendFile('views/slideshow.html', { root: import.meta.dirname })
})

app.get('/settings', checkAuthenticated, (req, res) => {
  res.sendFile('views/settings.html', { root: import.meta.dirname })
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.get('/downloads', (req, res) => {
  // Initialise the beer information so that `CURRENT_BEERS_FILE` is available
  initialiseBeers().then(() => {
    res.sendFile('views/downloads.html', { root: import.meta.dirname })
  })
})

app.get('/map', (req, res) => {
  res.sendFile('views/map.html', { root: import.meta.dirname })
})

app.get('/brewery-wikidata-query', (req, res) => {
  // Initialise the beer information so that `brewery_query_url` is up-to-date
  initialiseBeers().then(() => {
    // Return the query URL minus the format param so that the link takes you to the query service
    res.redirect(brewery_query_url.replace('sparql?format=json&query=', '#'))
  })
})

app.get('/downloads/breweries.geojson', (req, res) => {
  // Initialise the beer information so that `brewery_geojson` is up-to-date
  initialiseBeers().then(() => {
    res.send(brewery_geojson)
  })
})

app.get('/bridge', (req, res) => {
  res.sendFile('views/bridge.html', { root: import.meta.dirname })
})

// Other routes
app.get('/robots.txt', (req, res) => {
  res.sendFile('views/misc/robots.txt', { root: import.meta.dirname })
})

app.get('/manifest.json', (req, res) => {
  res.sendFile('views/misc/manifest.json', { root: import.meta.dirname })
})

app.get('/sitemap.xml', (req, res) => {
  res.sendFile('views/misc/sitemap.xml', { root: import.meta.dirname })
})

app.get('/.well-known/security.txt', (req, res) => {
  res.sendFile('views/misc/security.txt', { root: import.meta.dirname })
})

app.get('/.well-known/keybase.txt', (req, res) => {
  res.sendFile('views/misc/keybase.txt', { root: import.meta.dirname })
})

app.get('/humans.txt', (req, res) => {
  res.sendFile('views/misc/humans.txt', { root: import.meta.dirname })
})

// Routes for socket.io
app.get('/js/socket.io.esm.min.js', (req, res) => {
  res.sendFile('node_modules/socket.io-client/dist/socket.io.esm.min.js', { root: import.meta.dirname })
})
app.get('/js/socket.io.esm.min.js.map', (req, res) => {
  res.sendFile('node_modules/socket.io-client/dist/socket.io.esm.min.js.map', { root: import.meta.dirname })
})

// Routes for Leaflet (the mapping package)
app.get('/js/leaflet-src.esm.js', (req, res) => {
  res.sendFile('node_modules/leaflet/dist/leaflet-src.esm.js', { root: import.meta.dirname })
})
app.get('/js/leaflet-src.esm.js.map', (req, res) => {
  res.sendFile('node_modules/leaflet/dist/leaflet-src.esm.js.map', { root: import.meta.dirname })
})
app.get('/css/leaflet.css', (req, res) => {
  res.sendFile('node_modules/leaflet/dist/leaflet.css', { root: import.meta.dirname })
})
app.get('/css/images/marker-icon.png', (req, res) => {
  res.sendFile('node_modules/leaflet/dist/images/marker-icon.png', { root: import.meta.dirname })
})
app.get('/css/images/marker-shadow.png', (req, res) => {
  res.sendFile('node_modules/leaflet/dist/images/marker-shadow.png', { root: import.meta.dirname })
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
      logger.info(`Client - ${thisSession} (${name}) - has entered the correct code`)
      req.session.name = name
      redisClient.SADD('authed_ids', thisSession)
      redisClient
        .SMEMBERS(`sock:${thisSession}`)
        .catch((error) => {
          handleError("Couldn't get session members from Redis", error)
        })
        .then((reply) => {
          for (const socket of reply) {
            io.to(socket).emit('auth', true)
          }
        })
      res.redirect('/')
    } else {
      logger.warn(`Client - ${thisSession} (${name}) - has entered the wrong code (${code})`)
      req.flash('error', 'Wrong code, please try again')
      res.redirect('login')
    }
  })
})

app.get('/logout', (req, res) => {
  const thisSession = req.session.id
  redisClient.SREM('authed_ids', thisSession)
  redisClient
    .SMEMBERS(`sock:${thisSession}`)
    .catch((error) => {
      handleError("Couldn't get session members from Redis", error)
    })
    .then((reply) => {
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

app.get('/api/beers/:number', cors(), (req, res) => {
  initialiseBeers().then(() => {
    res.send(beers[req.params.number])
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
      logger.error('Too many items in JSON')
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
    logger.error('API use is not enabled')
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
      logger.error('API: Number too high')
      res.status(400).send('Number too high')
    }
  } else {
    logger.error('API use is not enabled')
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
  res.status(404).sendFile('views/misc/404.html', { root: import.meta.dirname })
})

// Handle 500
app.use(function (error, req, res, next) {
  res.status(500).sendFile('views/misc/500.html', { root: import.meta.dirname })
  logger.error(`Server error: ${error}`)
})

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  // Track which sockets are related to each session
  redisClient.SADD(`sock:${socket.handshake.session.id}`, socket.id)

  // Check if the socket belongs to an authorised session
  redisClient
    .SISMEMBER('authed_ids', socket.handshake.session.id)
    .catch((error) => {
      handleError("Couldn't check authed_ids from Redis", error)
    })
    .then((reply) => {
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
  logger.info(`Client ${socket.id} connected (${pathname})`)

  // Send the configuration settings
  if (pathname === 'settings' || pathname === 'availability' || pathname === 'bot') {
    io.to(socket.id).emit('config', last_config)
  }

  // Send the beer information
  if (pathname === 'history' || pathname === 'availability' || pathname === 'map' || pathname === 'bot') {
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
    redisClient
      .ZRANGE('log', 0, -1)
      .catch((error) => {
        handleError("Couldn't check get log from Redis", error)
      })
      .then((reply) => {
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
    redisClient
      .SISMEMBER('authed_ids', socket.handshake.session.id)
      .catch((error) => {
        handleError("Couldn't check authed_ids from Redis", error)
      })
      .then((reply) => {
        if (reply) {
          updateRequired(name, table)
        } else {
          logger.error(`%Unauthenticated client ${socket.id} attempted to change the matrix with: ${table}`)
          io.to(socket.id).emit('replace-all', last_table)
        }
      })
  })

  socket.on('replace-all', (table) => {
    const name = socket.handshake.session.name
    redisClient
      .SISMEMBER('authed_ids', socket.handshake.session.id)
      .catch((error) => {
        handleError("Couldn't check authed_ids from Redis", error)
      })
      .then((reply) => {
        if (reply) {
          replaceAll(name, table)
        } else {
          logger.error(`%Unauthenticated client ${socket.id} attempted to change the matrix with: ${table}`)
          io.to(socket.id).emit('replace-all', last_table)
        }
      })
  })

  socket.on('update-single', (stock_level) => {
    const name = socket.handshake.session.name
    const number = stock_level.number
    const level = stock_level.level

    redisClient
      .SISMEMBER('authed_ids', socket.handshake.session.id)
      .catch((error) => {
        handleError("Couldn't check authed_ids from Redis", error)
      })
      .then((reply) => {
        if (reply) {
          updateSingle(name, number, level)
        } else {
          logger.error(`Unauthenticated client ${socket.id} attempted to change ${number} to ${level}`)
          io.to(socket.id).emit('replace-all', last_table)
        }
      })
  })

  socket.on('config', (configuration) => {
    redisClient
      .SISMEMBER('authed_ids', socket.handshake.session.id)
      .catch((error) => {
        handleError("Couldn't check authed_ids from Redis", error)
      })
      .then((reply) => {
        if (reply) {
          // Distribute and save the configuration
          logger.info(`Distributing configuration: ${JSON.stringify(configuration)}`)
          io.sockets.emit('config', configuration)
          last_config.confirm = configuration.confirm
          last_config.low_enable = configuration.low_enable
          redisClient.HSET('config', 'confirm', configuration.confirm.toString())
          redisClient.HSET('config', 'low_enable', configuration.low_enable.toString())
        } else {
          logger.error(
            `Unauthenticated client ${socket.id} attempted to change the config with: ${JSON.stringify(configuration)}`
          )
          io.to(socket.id).emit('config', last_config)
        }
      })
  })

  socket.on('beers-file', (beersFileText) => {
    logger.info(`New beers file received from ${socket.handshake.session.id}`)

    redisClient
      .SISMEMBER('authed_ids', socket.handshake.session.id)
      .catch((error) => {
        handleError("Couldn't check authed_ids from Redis", error)
      })
      .then((reply) => {
        if (reply) {
          beers = {}
          csvParse(beersFileText, { columns: true }).forEach((beer) => {
            beers[beer.beer_number] = beer
          })

          updateBeersFromWikidata(beers)
            .then((wikidata_beers) => {
              logger.info('Storing Wikidata claims')
              beers = wikidata_beers
            })
            .catch((error) => {
              logger.error(error)
            })
            .finally(() => {
              logger.info('Sending updated beer information')
              io.sockets.emit('beers', beers)

              logger.info('Saving new beer information CSV')
              saveCSV(beers)

              logger.info('Updating brewery query URL and GeoJSON')
              brewery_query_url = generateBreweryQuery(beers)
              brewery_geojson = generateBreweryGeojson(beers)

              logger.info('Saving beer information to Redis')
              saveBeers(beers)
            })
        } else {
          logger.error(
            `Unauthenticated client ${socket.id} attempted to change the beer information with: ${beersFileText}`
          )
          io.to(socket.id).emit('config', last_config)
        }
      })
  })

  socket.on('disconnect', () => {
    logger.info(`Client ${socket.id} disconnected`)
    redisClient.SREM(`sock:${socket.handshake.session.id}`, socket.id)
  })
})
