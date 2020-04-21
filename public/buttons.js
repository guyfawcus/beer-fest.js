/* eslint-env browser */
'use strict'

import { AUTHORISED, TO_CONFIRM, LOW_ENABLE, socket, empty_colour, low_colour, full_colour } from './core.js'

const stock_levels = {}

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
  const button = document.getElementById(`button_${number}`)
  if (level === 'empty') {
    console.log(`Setting ${number} as empty`)
    stock_levels[number] = 'empty'
    button.style.background = empty_colour
  } else if (level === 'low') {
    console.log(`Setting ${number} as low`)
    stock_levels[number] = 'low'
    button.style.background = low_colour
  } else if (level === 'full') {
    console.log(`Setting ${number} as full`)
    stock_levels[number] = 'full'
    button.style.background = full_colour
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
  updateFromState(table)
  console.groupEnd()
})

socket.on('update single', stock_level => {
  updateLevel(stock_level.number, stock_level.level)
})

window.updateNumber = updateNumber
