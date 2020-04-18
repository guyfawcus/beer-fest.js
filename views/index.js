/* eslint-env browser */
'use strict'

import { socket } from './core.js'

socket.on('auth', status => {
  if (status) {
    document.getElementById('login').innerHTML = 'Log out'
    document.getElementById('login').href = '/logout'
    console.log('Authenticated with server')
  } else {
    document.getElementById('login').innerHTML = 'Log in'
    document.getElementById('login').href = '/login'
    console.log('Not authenticated')
  }
})
