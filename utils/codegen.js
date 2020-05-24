#!/usr/bin/env node

'use strict'

const bcrypt = require('bcryptjs')
const readline = require('readline')
const { exec } = require('child_process')
const crypto = require('crypto')

/**
 * Running this script will generate a new ADMIN_CODE and COOKIE_SECRET
 * and inform you on how to set them for your environment
 *
 * If you run it with the --heroku flag, it will send the variables to Heroku
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('Enter new code: ', (code) => {
  rl.close()
  console.log()

  const hashedCode = bcrypt.hashSync(code, 10)
  const cookieSecret = crypto.randomBytes(64).toString('hex')

  if (process.argv.includes('--heroku')) {
    console.log('Setting $ADMIN_CODE and $COOKIE_SECRET Heroku variables')
    exec(`heroku config:set ADMIN_CODE='${hashedCode}' COOKIE_SECRET='${cookieSecret}'`)
  } else {
    console.log(
      'Plese set the $ADMIN_CODE environment variable by running:\n' + '\x1b[33m%s\x1b[0m',
      `export ADMIN_CODE='${hashedCode}'\n`
    )
    console.log(
      'Plese set the $COOKIE_SECRET environment variable by running:\n' + '\x1b[33m%s\x1b[0m',
      `export COOKIE_SECRET='${cookieSecret}'\n`
    )
  }
})
