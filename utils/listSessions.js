#!/usr/bin/env node

const redis = require('redis')
const client = redis.createClient(process.argv[2])

/**
 * Running this script will print out information about current sessions.
 * Passing a `redis://` URL as an argument will use that instead of defaulting to a local instance
 *
 * The format will be:
 *
 * | Time of last connection | How long before the session will be removed (TTL) |            The session ID             |
 * |        Sat 18:00        |                   (23:00) left                    | sess:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx |
 *
 */

const sessions = []

client.keys('sess:*', (err, reply) => {
  if (err) {
    console.error(`Couldn't get sessions from Redis - ${err.message})`)
    process.exit(1)
  }

  // Print out the number of connected sessions
  console.log(`${reply.length} sessions(s) connected in the last 24 hours\n`)

  // If there are no sessions to list then quit
  if (reply.length === 0) process.exit()

  // Get the TTL for each session
  reply.forEach((session, key, all) => {
    client.ttl(session, (err, reply) => {
      if (err) {
        console.error(`Couldn't get TTL for session from Redis - ${err.message})`)
        process.exit(1)
      }

      // Reduce precision of the current time because the TTL is returned as seconds
      const currentTime = Math.floor(Date.now() / 1000) * 1000

      // Convert TTL from seconds to milliseconds and generate a date object
      const ttl = reply * 1000
      const ttlObj = new Date(ttl)

      // The amount of time before a session is removed (one day in milliseconds)
      const offset = 86400000

      // Work out when the session was initiated
      const sessionConnectionTimeObj = new Date(currentTime + ttl - offset)

      // Add the session info the the list
      sessions.push({ session: session, ttl: ttlObj, time: sessionConnectionTimeObj })

      // If this is the last session then parse the lot and exit
      if (Object.is(all.length - 1, key)) {
        parseAll(sessions)
        process.exit()
      }
    })
  })
})

function parseAll(sessions) {
  // Sort by time (most recent first)
  sessions.sort((a, b) => b.time - a.time)

  // Print out the information for each session
  sessions.forEach((session) => {
    const sessionConnectionTime = session.time.toLocaleTimeString([], {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    const timeLeftMin = ('0' + session.ttl.getUTCHours()).slice(-2)
    const timeLeftSec = ('0' + session.ttl.getUTCMinutes()).slice(-2)
    console.log(`${sessionConnectionTime} (${timeLeftMin}:${timeLeftSec} left) ${session.session}`)
  })
}
