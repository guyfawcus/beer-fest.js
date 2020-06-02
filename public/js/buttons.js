/* eslint-env browser */
'use strict'

import {
  applyChecks,
  buildCross,
  generateCheckedHexURL,
  getChecks,
  parseCheckedHexData,
  refreshButtons,
  socket,
  updateLevel,
  updateNumber
} from './core.js'

// Add event listeners and build a cross for each button
for (let number = 1; number <= 80; number++) {
  const button = document.getElementById(`button_${number}`)
  button.addEventListener('click', (event) => updateNumber(number))
  buildCross(number)
}

// Get the checkedHexData from the URL, parse it if it's present, read in from local storage if not
const checkedHexData = new URL(location.href).searchParams.get('checked')
if (checkedHexData) {
  const numbersChecked = parseCheckedHexData(checkedHexData)
  applyChecks(numbersChecked)

  // Remove the checkedHexData from the URL so that it's not used if you refresh the page
  history.replaceState(null, '', location.href.split('?')[0])
} else {
  applyChecks(getChecks())
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
const clear_checks = document.getElementById('clear-checks')
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
clear_checks.addEventListener('click', (event) => {
  if (!confirm('Are you sure you want to clear all of your check marks?')) return
  applyChecks([])
  document.getElementById('check-share-url').href = generateCheckedHexURL().toString()
})

info_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NO_INFORMATION', 'true')
    refreshButtons()
  } else {
    localStorage.removeItem('HIDE_NO_INFORMATION')
    refreshButtons()
  }
})
vegan_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NOT_VEGAN', 'true')
    refreshButtons()
  } else {
    localStorage.removeItem('HIDE_NOT_VEGAN')
    refreshButtons()
  }
})
gluten_free_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NOT_GLUTEN_FREE', 'true')
    refreshButtons()
  } else {
    localStorage.removeItem('HIDE_NOT_GLUTEN_FREE')
    refreshButtons()
  }
})

// Show menu if the header is clicked on
document.getElementById('buttons_header').addEventListener('click', () => {
  // Update check share URL
  document.getElementById('check-share-url').href = generateCheckedHexURL().toString()
  document.getElementById('popup-background').classList.add('show')
  document.getElementById('popup-menu').classList.add('show')
})

// Hide menu if anywhere other than the popup is clicked on
document.addEventListener('click', () => {
  if (!event.target.closest('#popup-menu') && !event.target.closest('#buttons_header')) {
    document.getElementById('popup-background').classList.remove('show')
    document.getElementById('popup-menu').classList.remove('show')
  }
})

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------
// Update the state when remotes send updates
socket.on('replace-all', (table) => {
  console.groupCollapsed('Updating all entities')
  console.log('%cUpdating table from:', 'font-weight:bold;')
  console.log(table)
  for (const number in table) {
    updateLevel(Number(number), table[number])
  }
  console.groupEnd()
})

socket.on('update-single', (stock_level) => {
  updateLevel(stock_level.number, stock_level.level)
})

socket.on('beers', (beerList) => {
  refreshButtons()
})
