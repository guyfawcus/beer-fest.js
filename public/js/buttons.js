/* eslint-env browser */
'use strict'

import {
  buildCross,
  generateCheckedHexURL,
  parseCheckedHexData,
  rereshButtons,
  setCross,
  socket,
  updateLevel,
  updateNumber,
  updateFromState,
  applyChecks
} from './core.js'

for (let number = 1; number <= 80; number++) {
  const button = document.getElementById(`button_${number}`)
  button.addEventListener('click', (event) => updateNumber(number))
  buildCross(number)
}

function updateChecked() {
  for (let number = 1; number <= 80; number++) {
    const checkedState = localStorage.getItem(number.toString())
    if (checkedState === 'checked') {
      setCross(number)
    } else {
      setCross(number, false)
    }
  }
}

// Get the checkedHexData from the URL, parse it if it's present, read in from local storage if not
const checkedHexData = new URL(window.location.href).searchParams.get('checked')
if (checkedHexData) {
  const numbersChecked = parseCheckedHexData(checkedHexData)
  applyChecks(numbersChecked)

  // Remove the checkedHexData from the URL so that it's not used if you refresh the page
  history.replaceState(null, '', window.location.href.split('?')[0])
} else {
  updateChecked()
}

// Update the state when remotes send updates
socket.on('update table', (table) => {
  console.groupCollapsed('Updating all entities')
  updateFromState(table)
  console.groupEnd()
})

socket.on('update single', (stock_level) => {
  updateLevel(stock_level.number, stock_level.level)
})

socket.on('beers', (beerList) => {
  rereshButtons()
})

const info_checkbox = document.getElementById('info_check')
const vegan_checkbox = document.getElementById('vegan_check')
const gluten_free_checkbox = document.getElementById('gluten_free_check')

// Get previous option states
if (localStorage.getItem('HIDE_NO_INFORMATION') === 'true') {
  info_checkbox.checked = true
} else {
  info_checkbox.checked = false
}
if (localStorage.getItem('HIDE_NOT_VEGAN') === 'true') {
  vegan_checkbox.checked = true
} else {
  vegan_checkbox.checked = false
}
if (localStorage.getItem('HIDE_NOT_GLUTEN_FREE') === 'true') {
  gluten_free_checkbox.checked = true
} else {
  gluten_free_checkbox.checked = false
}

// Add event listeners for options
info_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NO_INFORMATION', 'true')
    rereshButtons()
  } else {
    localStorage.removeItem('HIDE_NO_INFORMATION')
    rereshButtons()
  }
})
vegan_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NOT_VEGAN', 'true')
    rereshButtons()
  } else {
    localStorage.removeItem('HIDE_NOT_VEGAN')
    rereshButtons()
  }
})
gluten_free_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NOT_GLUTEN_FREE', 'true')
    rereshButtons()
  } else {
    localStorage.removeItem('HIDE_NOT_GLUTEN_FREE')
    rereshButtons()
  }
})

// Show menu
document.getElementById('buttons_header').addEventListener('click', () => {
  // Update check share URL
  document.getElementById('check-share-url').href = generateCheckedHexURL().toString()
  document.getElementById('popup-background').classList.add('show')
  document.getElementById('popup-menu').classList.add('show')
})

// Hide menu
document.addEventListener('click', () => {
  if (!event.target.closest('#popup-menu') && !event.target.closest('#buttons_header')) {
    document.getElementById('popup-background').classList.remove('show')
    document.getElementById('popup-menu').classList.remove('show')
  }
})

// Clear checks
document.getElementById('clear-checks').addEventListener('click', (event) => {
  if (!confirm('Are you sure you want to clear all of your check marks?')) return
  for (let number = 1; number <= 80; number++) localStorage.removeItem(number)
  updateChecked()
  document.getElementById('check-share-url').href = generateCheckedHexURL().toString()
})
