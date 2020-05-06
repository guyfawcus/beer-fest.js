/* eslint-env browser */
'use strict'

import {
  setCross,
  setTooltip,
  socket,
  updateLevel,
  updateFromState
} from './core.js'

for (let number = 1; number <= 80; number++) {
  const checkedState = localStorage.getItem(number)
  if (checkedState === 'checked') {
    setCross(number)
  } else {
    setCross(number, false)
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

socket.on('beers', beerList => {
  for (let i = 1; i <= 80; i++) {
    const button = document.getElementById(`button_${i}`)
    setTooltip(i, button)
  }
})
