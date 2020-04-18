/* eslint-env browser */
'use strict'

import { socket } from './core.js'

const empty_colour = getComputedStyle(document.body).getPropertyValue('--empty-colour')
const low_colour = getComputedStyle(document.body).getPropertyValue('--low-colour')
const full_colour = getComputedStyle(document.body).getPropertyValue('--full-colour')
const stock_levels = {}

let TO_CONFIRM = true
let LOW_ENABLE = false
let AUTHORISED = false

const confirmUpdate = (number, level, to_confirm = TO_CONFIRM) => {
  if (to_confirm) {
    if (confirm(`Are you sure you want to mark number ${number} as ${level}`) !== true) {
    }
  }
  socket.emit('update single', { number: number, level: level })
}

const updateNumber = number => {
  if (AUTHORISED) {
    if (stock_levels[number] === 'full') {
      if (LOW_ENABLE === true) {
        confirmUpdate(number, 'low')
      } else {
        confirmUpdate(number, 'empty')
      }
    } else if (stock_levels[number] === 'low') {
      confirmUpdate(number, 'empty')
    } else if (stock_levels[number] === 'empty') {
      confirmUpdate(number, 'full')
    }
  } else {
    console.log('Not authorised')
  }
}

// Change the colour of the button depending on the stock level
const updateLevel = (number, level) => {
  const button_id = document.getElementById(`button_${number}`)
  if (level === 'empty') {
    console.log(`Setting ${number} as empty`)
    stock_levels[number] = 'empty'
    button_id.style.background = empty_colour
  } else if (level === 'low') {
    console.log(`Setting ${number} as low`)
    stock_levels[number] = 'low'
    button_id.style.background = low_colour
  } else if (level === 'full') {
    console.log(`Setting ${number} as full`)
    stock_levels[number] = 'full'
    button_id.style.background = full_colour
  }
}

// Update the table based on remote changes to the stock levels
const updateFromState = stock_levels => {
  console.log('%cUpdating table from:', 'font-weight:bold;')
  console.log(stock_levels)
  for (const number in stock_levels) {
    if (stock_levels[number] === 'empty') {
      updateLevel(number, 'empty')
    } else if (stock_levels[number] === 'low') {
      updateLevel(number, 'low')
    } else if (stock_levels[number] === 'full') {
      updateLevel(number, 'full')
    }
  }
}

// Update the state when remotes send updates
socket.on('update table', table => {
  console.groupCollapsed('Updating all entities')
  updateFromState(JSON.parse(table))
  console.groupEnd()
})

socket.on('update single', stock_level => {
  updateLevel(stock_level.number, stock_level.level)
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

socket.on('auth', status => {
  if (status) {
    AUTHORISED = true
    console.log('Authenticated with server')
  } else {
    AUTHORISED = false
    console.log('Not authenticated')
  }
})

window.updateNumber = updateNumber
