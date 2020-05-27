/* eslint-env browser */
/* global globalThis */

const bfjsSocket = globalThis.io.connect(location.host)
const qlcSocket = new WebSocket('ws://127.0.0.1:9999/qlcplusWS')

let qlcConnected
let r = 0
let g = 0
let b = 0

// Translate the hex values from the main stylesheet to RGB values
function rgbFromVar(colour_variable) {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(colour_variable).slice(2)
  const bigint = parseInt(hex, 16)
  r = (bigint >> 16) & 255
  g = (bigint >> 8) & 255
  b = bigint & 255

  return [r, g, b]
}

// Transform the data and send it to QLC+
function sendData(number, level) {
  if (level === 'empty') [r, g, b] = rgbFromVar('--empty-colour')
  if (level === 'low') [r, g, b] = rgbFromVar('--low-colour')
  if (level === 'full') [r, g, b] = rgbFromVar('--full-colour')

  if (qlcConnected === true) {
    qlcSocket.send('CH|' + (number * 3 - 2) + '|' + r)
    qlcSocket.send('CH|' + (number * 3 - 1) + '|' + g)
    qlcSocket.send('CH|' + (number * 3 - 0) + '|' + b)
  }
}

// Handle connection events
bfjsSocket.on('connect', () => {
  console.log('Connected to beer-fest.js')
})

bfjsSocket.on('disconnect', () => {
  console.log('Disconnected from beer-fest.js')
})

qlcSocket.onopen = () => {
  qlcConnected = true
  console.log('Connected to QLC+')
}

qlcSocket.onclose = () => {
  qlcConnected = false
  console.log('Disconnected from QLC+')
}

// Send data to QLC+ when messages are received from beer-fest.js
bfjsSocket.on('update-single', (stock_level) => {
  const number = stock_level.number
  const level = stock_level.level
  sendData(number, level)
})

bfjsSocket.on('replace-all', (stock_levels) => {
  for (const number in stock_levels) {
    sendData(number, stock_levels[number])
  }
})
