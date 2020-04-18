/* eslint-env browser */
/* global io */
'use strict'

export let AUTHORISED = false
export let TO_CONFIRM = true
export let LOW_ENABLE = false
export const socket = io.connect(self.location.host)

socket.on('connect', () => {
  console.log('Server connected')
  document.getElementsByClassName('warning_icon')[0].style.display = 'none'
})

socket.on('disconnect', () => {
  window.setTimeout(() => {
    if (socket.connected !== true) {
      console.log('%cServer diconnected!', 'color:red;')
      document.getElementsByClassName('warning_icon')[0].style.display = 'grid'
    }
  }, 2000)
})

socket.on('auth', status => {
  const loginElement = document.getElementById('login')

  if (status) {
    AUTHORISED = true
    console.log('Authenticated with server')
    if (loginElement) {
      loginElement.innerHTML = 'Log out'
      loginElement.href = '/logout'
    }
  } else {
    AUTHORISED = false
    console.log('Not authenticated')
    if (loginElement) {
      loginElement.innerHTML = 'Log in'
      loginElement.href = '/login'
    }
  }
})

socket.on('config', configuration => {
  console.log('%cUpdating configuration from:', 'font-weight:bold;')
  console.log(configuration)
  if (configuration.confirm) {
    TO_CONFIRM = true
  } else {
    TO_CONFIRM = false
  }
  if (configuration.low_enable) {
    LOW_ENABLE = true
  } else {
    LOW_ENABLE = false
  }
})
