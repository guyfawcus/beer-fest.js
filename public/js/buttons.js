/* eslint-env browser */
'use strict'

import {
  generateCheckedHexURL,
  parseCheckedHexData,
  setColour,
  setCross,
  setTooltip,
  socket,
  updateLevel,
  updateFromState
} from './core.js'

for (let number = 1; number <= 80; number++) {
  const button = document.getElementById(`button_${number}`)

  const cross = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const backslash = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  const forward_slash = document.createElementNS('http://www.w3.org/2000/svg', 'line')

  cross.setAttribute('class', 'cross')
  cross.setAttribute('id', `cross_${number}`)
  // Layer the cross underneath the number
  // cross.setAttribute('style', 'z-index:-1')

  backslash.setAttribute('class', 'backslash')
  backslash.setAttribute('x1', '10')
  backslash.setAttribute('y1', '10')
  backslash.setAttribute('x2', '90')
  backslash.setAttribute('y2', '90')

  forward_slash.setAttribute('class', 'forward_slash')
  forward_slash.setAttribute('x1', '10')
  forward_slash.setAttribute('y1', '90')
  forward_slash.setAttribute('x2', '90')
  forward_slash.setAttribute('y2', '10')

  cross.appendChild(backslash)
  cross.appendChild(forward_slash)
  button.appendChild(cross)
}

function updateChecked () {
  for (let number = 1; number <= 80; number++) {
    const checkedState = localStorage.getItem(number.toString())
    if (checkedState === 'checked') {
      setCross(number)
    } else {
      setCross(number, false)
    }
  }
}

/**
 * Capture keyboard event
 * This is only a temporary function while a better solution is implemented
 * @param {KeyboardEvent} e
 */
function keyUp (e) {
  // If Ctrl+C clear the checks
  if (e.ctrlKey && e.keyCode === 67) {
    console.log(e)
    localStorage.clear()
    updateChecked()
  }
  // If Ctrl+A add the CheckedHexData to the URL
  if (e.ctrlKey && e.keyCode === 65) {
    generateCheckedHexURL(true)
  }
}

// Get the checkedHexData from the URL, parse it if it's present, read in from local storage if not
const checkedHexData = new URL(window.location.href).searchParams.get('checked')
if (checkedHexData) {
  parseCheckedHexData(checkedHexData)

  // Remove the checkedHexData from the URL so that it's not used if you refresh the page
  history.replaceState(null, '', window.location.href.split('?')[0])
} else {
  updateChecked()
}

document.addEventListener('keyup', keyUp, false)

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
    setColour(i, undefined, button)
  }
})
