#!/usr/bin/env node

'use strict'

const bcrypt = require('bcryptjs')
const readline = require('readline')
const { exec } = require('child_process')
const crypto = require('crypto')

const cookieSecret = crypto.randomBytes(32).toString('hex')
console.log(cookieSecret)
exec(`heroku config:set COOKIE_SECRET='${cookieSecret}'`)

let hashedCode = ''

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('Enter new code: ', (code) => {
  hashedCode = bcrypt.hashSync(code, 6)
  console.log(hashedCode)
  exec(`heroku config:set ADMIN_CODE='${hashedCode}'`)
  rl.close()
})
