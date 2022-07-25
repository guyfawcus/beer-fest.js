/* eslint-env browser */
'use strict'

import {
  applyChecks,
  buildCross,
  checkHistory,
  generateCheckedHexURL,
  buildInfoModal,
  parseCheckedHexData,
  refreshButtons,
  socket,
  updateLevel,
  updateNumber
} from './core.js'

// ---------------------------------------------------------------------------
// Wrapper functions
// ---------------------------------------------------------------------------
function clickButton(number) {
  checkHistory.clearFuture()
  if (new URL(location.href).searchParams.get('info') !== 'true') {
    updateNumber(number)
  } else {
    document.getElementById('popup-background').classList.add('show')
    document.getElementById(`info_modal_${number}`).classList.add('show')
  }
}

function openMenuPopup() {
  // Update check share URL
  document.getElementById('check-share-url').href = generateCheckedHexURL().toString()
  document.getElementById('popup-background').classList.add('show')
  document.getElementById('popup-menu').classList.add('show')
}

function closeAllPopups() {
  for (const popup of document.getElementsByClassName('popup')) popup.classList.remove('show')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
// Perform actions to prepare each button
const buttons = document.getElementsByClassName('availability_button')
for (const button of buttons) {
  const number = Number(button.id.split('_')[1])

  // Build a cross on the button
  buildCross(number)

  // Build the information modal on the button
  buildInfoModal(number)

  // Allow tabbing through the buttons
  button.setAttribute('tabindex', '0')

  // Handle a normal pointer click
  button.addEventListener('click', (event) => {
    clickButton(number)
  })

  // Handle a click by using the 'Enter' key if the button is focused
  button.onkeyup = (eventObj) => {
    if (eventObj.key === 'Enter') {
      clickButton(number)
    }
  }
}

// Add listeners for keypress events
document.onkeydown = (eventObj) => {
  if (eventObj.ctrlKey && eventObj.key === 'z') checkHistory.undo()
  if (eventObj.ctrlKey && eventObj.key === 'y') checkHistory.redo()
  if (eventObj.key === 'Escape') {
    closeAllPopups()
    document.body.classList.remove('keyboardControl')
  }

  // Activate 'keyboardControl' mode if 'Tab' or 'Shift+Tab' are pressed
  if (eventObj.key === 'Tab' || (eventObj.shiftKey && eventObj.key === 'Tab')) {
    document.body.classList.add('keyboardControl')
  }
}

// Deactivate 'keyboardControl' mode if the mouse is moved
document.onmousemove = (eventObj) => {
  document.body.classList.remove('keyboardControl')
}

// Show menu if the header is clicked on
document.getElementById('burger_menu').addEventListener('click', () => {
  openMenuPopup()
})

// Hide menu if anywhere other than the popup is clicked on
document.addEventListener('click', (event) => {
  if (event.target.closest('#popup-background')) closeAllPopups()
})

// Get the checkedHexData from the URL, parse it if it's present, read in from local storage if not
const checkedHexData = new URL(location.href).searchParams.get('checked') || localStorage.getItem('checkedHexData')
if (checkedHexData) {
  const numbersChecked = parseCheckedHexData(checkedHexData)
  checkHistory.clearFuture()
  applyChecks(numbersChecked)
}

// Remove the checkedHexData from the URL so that it's not used if you refresh the page
const newUrl = new URL(location.href)
newUrl.searchParams.delete('checked')
history.replaceState(null, '', newUrl.toString())

// Set the default state for options
if (!localStorage.getItem('HIDE_NO_INFORMATION')) {
  localStorage.setItem('HIDE_NO_INFORMATION', 'true')
}
if (!localStorage.getItem('HIDE_NOT_VEGAN')) {
  localStorage.setItem('HIDE_NOT_VEGAN', 'false')
}
if (!localStorage.getItem('HIDE_NOT_GLUTEN_FREE')) {
  localStorage.setItem('HIDE_NOT_GLUTEN_FREE', 'false')
}

// Update this page if changes are made to another one on the same device
window.onstorage = (event) => {
  const changeEvent = new Event('change')
  if (event.key === 'HIDE_NO_INFORMATION') {
    if (event.newValue === 'true') {
      info_checkbox.checked = true
      info_checkbox.dispatchEvent(changeEvent)
    } else {
      info_checkbox.checked = false
      info_checkbox.dispatchEvent(changeEvent)
    }
  } else if (event.key === 'HIDE_NOT_VEGAN') {
    if (event.newValue === 'true') {
      vegan_checkbox.checked = true
      vegan_checkbox.dispatchEvent(changeEvent)
    } else {
      vegan_checkbox.checked = false
      vegan_checkbox.dispatchEvent(changeEvent)
    }
  } else if (event.key === 'HIDE_NOT_GLUTEN_FREE') {
    if (event.newValue === 'true') {
      gluten_free_checkbox.checked = true
      gluten_free_checkbox.dispatchEvent(changeEvent)
    } else {
      gluten_free_checkbox.checked = false
      gluten_free_checkbox.dispatchEvent(changeEvent)
    }
  } else if (event.key === 'checkedHexData') {
    const numbersChecked = parseCheckedHexData(event.newValue)
    applyChecks(numbersChecked, false)
  }
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
  checkHistory.clearFuture()
  applyChecks([])
  document.getElementById('check-share-url').href = generateCheckedHexURL().toString()
})

info_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NO_INFORMATION', 'true')
    refreshButtons()
  } else {
    localStorage.setItem('HIDE_NO_INFORMATION', 'false')
    refreshButtons()
  }
})
vegan_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NOT_VEGAN', 'true')
    refreshButtons()
  } else {
    localStorage.setItem('HIDE_NOT_VEGAN', 'false')
    refreshButtons()
  }
})
gluten_free_checkbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    localStorage.setItem('HIDE_NOT_GLUTEN_FREE', 'true')
    refreshButtons()
  } else {
    localStorage.setItem('HIDE_NOT_GLUTEN_FREE', 'false')
    refreshButtons()
  }
})

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------
socket.on('replace-all', (table) => {
  console.groupCollapsed('Updating all entities')
  console.debug('%cUpdating table from:', 'font-weight:bold;')
  console.debug(table)
  for (const number in table) {
    updateLevel(Number(number), table[number])
  }
  console.groupEnd()
})

socket.on('update-single', (stock_level) => {
  updateLevel(stock_level.number, stock_level.level)
})

socket.on('beers', (beerList) => {
  console.debug('%cUpdating info from:', 'font-weight:bold;')
  console.debug(beerList)
  refreshButtons()
})
