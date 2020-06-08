/*!
 * https://github.com/guyfawcus/beer-fest.js
 *
 * (c) 2020 - James Fawcus-Robinson
 * Released under the MIT License.
 */

/* eslint-env browser */
/* global globalThis */
'use strict'

/** `true` is a user is logged in */
export let AUTHORISED = false

/** `true` if the confirmation window should pop up before an update */
export let TO_CONFIRM = true

/** `true` if the middle 'low' level is to be used as a state */
export let LOW_ENABLE = false

/**
 * A list of [beer objects]{@link beersObj} containing information for each beer
 * @type{beersObj[]}
 */
let BEERS = []

/**
 * Simple key value store that conforms to {@link stockLevelsObj},
 * where a number is the key and a [level]{@link levelValues} is the value
 * @type{stockLevelsObj}
 */
let STOCK_LEVELS = {}

/** The total number of availability buttons */
const NUM_OF_BUTTONS = document.getElementsByClassName('availability_button').length || 80

/** The socket.io socket object */
export const socket = globalThis.io.connect(location.host)

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
/**
 * The different level values that can be used
 * @typedef {('empty'|'low'|'full')} levelValues
 */

/**
 * Object structure that represents each beer. Used in {@link BEERS}
 * @typedef {object} beersObj
 * @property {string} beer_number The number of the beer
 * @property {string} beer_name The name of the beer
 * @property {string} brewer The brewer of the beer
 * @property {string} abv The alcohol by volume of the beer
 * @property {string} beer_style The style of the beer
 * @property {string} vegan 'y' if the beer is vegan
 * @property {string} gluten_free 'y' if the beer is gluten free
 * @property {string} description A description of the beer
 */

/** Object to store the stock level for a particular beer. Used in {@link STOCK_LEVELS}
 * @typedef {Object} stockLevelsObj
 * @property {number} number The number of the beer
 * @property {levelValues} level The level that the beer is set to
 */

/** Object to store the stock level and other info for an update. Used in {@link updateHistory}
 * @typedef {Object} singleUpdateObj
 * @property {number} epoch_time Time since the the Unix epoch that the update was performed
 * @property {string} day The day name when the update was performed
 * @property {string} time The time in 24hr format when the update was performed
 * @property {string} name The name of the person who generated the update
 * @property {number} number The number of the beer that was changed
 * @property {levelValues} level The level that the beer is set to
 */

// ---------------------------------------------------------------------------
// Shared functions
// ---------------------------------------------------------------------------
/**
 * Function that updates the tooltip for the selected number.
 * @param {number} number The number that of the beer - used as an ID to get data from {@link BEERS}
 * @param {HTMLDivElement} element The element that the tooltip is to be added to
 */
export function setTooltip(number, element) {
  const thisBeer = BEERS[number - 1]
  if (thisBeer !== undefined) {
    let vegan = ''
    if (thisBeer.vegan === 'y') {
      vegan = ' (Ve)'
    }
    let glutenFree = ''
    if (thisBeer.gluten_free === 'y') {
      glutenFree = ' (GF)'
    }
    const header = `${thisBeer.beer_number} - ${thisBeer.beer_name}${vegan}${glutenFree}`
    const divider = '-'.repeat(header.length + 10)
    element.title = `${header}\n${divider}\n${thisBeer.brewer}\n${thisBeer.abv}\n${thisBeer.beer_style}\n${thisBeer.description}`
  }
}

/**
 * Function to change the background colour of an element depending on the level.
 * @param {number} number The number to be updated
 * @param {levelValues} level The level that the element is to be changed to. If this is undefined, the last level will be used
 * @param {HTMLElement} element The element whose background is to be changed
 * This can't be inferred from the number because this function is used in other places,
 * namely the history page, where the div doesn't have an ID in the format `button_<number>`
 */
function setColour(number, level, element) {
  if (!element) return
  const thisBeer = BEERS[number - 1]
  if (!level) level = STOCK_LEVELS[number]

  if (level === 'empty') {
    element.style.background = 'var(--empty-colour)'
  }
  if (level === 'low') {
    element.style.background = 'var(--low-colour)'
  }
  if (level === 'full') {
    element.style.background = 'var(--full-colour)'
  }

  if (localStorage.HIDE_NO_INFORMATION === 'true' && !thisBeer) {
    element.style.background = 'var(--hide-colour)'
  }

  if (localStorage.HIDE_NOT_VEGAN === 'true' && thisBeer && thisBeer.vegan !== 'y') {
    element.style.background = 'var(--hide-colour)'
  }

  if (localStorage.HIDE_NOT_GLUTEN_FREE === 'true' && thisBeer && thisBeer.gluten_free !== 'y') {
    element.style.background = 'var(--hide-colour)'
  }
}

// ---------------------------------------------------------------------------
// Button / Availability functions
// ---------------------------------------------------------------------------
/**
 * This function generates an SVG cross and adds it to a button element.
 * @param {number} number The button number to add the cross to
 */
export function buildCross(number) {
  const element = document.getElementById(`button_${number}`)

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
  element.appendChild(cross)
}

/**
 * Add or remove the cross on the selected number.
 * @param {number} number The number to set or remove the cross on
 * @param {boolean} [checked] If `true`, the cross will be added. If false, it will be removed
 * @param {boolean} [store] If 'true', the checkedHexData in localStorage will be updated
 */
function setCross(number, checked = true, store = true) {
  const button = document.getElementById(`button_${number}`)
  if (!button) return
  const cross = button.getElementsByClassName('cross')[0]

  if (checked === false) {
    cross.classList.remove('checked')
  } else {
    cross.classList.add('checked')
  }

  if (store === true) {
    const numbersChecked = parseCheckedHexData(localStorage.getItem('checkedHexData')) || []

    if (checked === false) {
      const index = numbersChecked.indexOf(number)
      if (index > -1) numbersChecked.splice(index, 1)
    } else {
      if (!(number in numbersChecked)) numbersChecked.push(number)
    }
    localStorage.setItem('checkedHexData', generateCheckedHexData(numbersChecked))
  }
}

/**
 * This simple wrapper function just runs
 * {@link setTooltip} and {@link setColour} every button.
 */
export function refreshButtons() {
  const transitionTime = getComputedStyle(document.body).getPropertyValue('--transition-time')
  const buttons = document.getElementsByClassName('availability_button')

  for (const button of buttons) {
    const number = Number(button.id.split('_')[1])
    // Deactivate transitions because transitioning everything causes jank on mobile
    button.style.transition = 'none'
    setTooltip(number, button)
    setColour(number, undefined, button)
    // Restore transitions - setTimeout of 0 is needed to make sure the call stack is clear
    setTimeout(() => (button.style.transition = `all ${transitionTime}`), 0)
  }
}

/**
 * This reads in the checks array see what numbers are checked.
 * It then makes an array of Uint8 bytes where each bit represents the checked state of a number,
 * for example, if the first byte was `0b01001011` (`0x4a`) then numbers 2, 5, 7 and 8 are checked.
 * It returns the the array formatted as base-16 hex so that it can be used in a URL.
 * @param {array} numbersChecked list of all of the checked numbers
 * @returns {string} hex formatted string
 */
function generateCheckedHexData(numbersChecked = []) {
  if (!numbersChecked || numbersChecked.length === 0) return ''

  const biggestNumber = Math.max(...numbersChecked)
  const numOfBytesNeeded = Math.ceil(biggestNumber / 8)
  const checkedData = new Uint8Array(numOfBytesNeeded)
  let byteNum = 0
  let bitNum = 0

  for (let number = 1; number <= biggestNumber; number++) {
    // Set the bit if the number is checked
    if (numbersChecked.includes(number)) checkedData[byteNum] |= 1 << (7 - bitNum)

    if (number % 8 === 0) {
      byteNum += 1
      bitNum = 0
    } else {
      bitNum++
    }
  }

  // Transform byte array to a hex string
  let checkedHexData = checkedData.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
  // Remove the last nibble if it's empty as it's not needed for decoding
  if (checkedHexData[checkedHexData.length - 1] === '0') checkedHexData = checkedHexData.slice(0, -1)
  return checkedHexData
}

/**
 * This gets all of the checks then generates checkedHexData to add to a URL
 * by using {@link parseCheckedHexData} and {@link generateCheckedHexData}.
 * This is used if you want to share the numbers that you've checked off with someone / back them up.
 * @param {boolean} [updateURL] If set to `true`, the URL of the page will be updated with the result
 * @returns {URL} The full URL including the checked hex data as a search parameter
 */
export function generateCheckedHexURL(updateURL = false) {
  const numbersChecked = parseCheckedHexData(localStorage.getItem('checkedHexData'))
  const checkedHexData = generateCheckedHexData(numbersChecked)
  const url = new URL(location.href)
  url.searchParams.set('checked', checkedHexData)
  if (updateURL) history.replaceState(null, '', url.toString())
  return url
}

/**
 * This parses the checkedHexData and returns a list of the numbers checked.
 * @param {string} checkedHexData A hex formatted string containing the checked data
 * @returns {number[] | undefined} A list of all of the numbers that are checked
 */
export function parseCheckedHexData(checkedHexData) {
  if (!checkedHexData) return
  // Pad string to be a multiple of an 8 bit byte if the string ends in a nibble
  if (checkedHexData.length % 2 !== 0) checkedHexData = checkedHexData += '0'

  // Parse the hex string into a Uint8Array
  const checkedData = new Uint8Array(checkedHexData.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
  const numbersChecked = []

  // Loop over all of the bits in each byte
  for (let byteNum = 0; byteNum < checkedData.length; byteNum++) {
    for (let bitNum = 0; bitNum < 8; bitNum++) {
      const overallBitNum = byteNum * 8 + bitNum + 1

      // If the bit is set it means that the number is checked
      if ((checkedData[byteNum] & (1 << (7 - bitNum))) !== 0) {
        numbersChecked.push(overallBitNum)
      }
    }
  }
  return numbersChecked
}

/**
 * Takes a list of the numbers checked then sets them using {@link setCross}.
 * @param {array} numbersChecked The numbers checked
 */
export function applyChecks(numbersChecked = []) {
  localStorage.setItem('checkedHexData', generateCheckedHexData(numbersChecked))

  for (let number = 1; number <= NUM_OF_BUTTONS; number++) {
    if (numbersChecked.includes(number)) {
      setCross(number, true, false)
    } else {
      setCross(number, false, false)
    }
  }
}

/**
 * If a user is not logged in ({@link AUTHORISED}) then the number will be checked off
 * (a cross will be added / removed using {@link setCross}.
 * If they are logged in then the level of the beer will be updated
 * (the colour will be changed using {@link setColour}).
 * @param {number} number The number to update the level of / set the cross
 */
export function updateNumber(number) {
  const button = document.getElementById(`button_${number}`)
  const cross = button.getElementsByClassName('cross')[0]

  if (!AUTHORISED) {
    // If the number has a cross on it already, remove it. Otherwise, set it.
    if (cross.classList.contains('checked')) {
      setCross(number, false)
    } else {
      setCross(number)
    }
    return
  }

  /**
   * Pop up a confirmation window if `TO_CONFIRM` is true
   * @param {levelValues} level The level that the number will be set to
   */
  const confirmUpdate = (level) => {
    if (TO_CONFIRM) {
      const thisBeer = BEERS[number - 1]
      let message = ''
      if (thisBeer !== undefined) {
        message = `Are you sure you want to mark ${thisBeer.beer_name} (${number}) as ${level}?`
      } else {
        message = `Number ${number} is not in the list of beers, would you still like to mark it as ${level}?`
      }
      if (confirm(message) !== true) {
        return
      }
    }
    // Change the colour for instant feedback but don't change any local state, just send the update
    setColour(number, level, button)
    socket.emit('update-single', { number: number, level: level })
  }

  // This is needed if buttons have been added but STOCK_LEVELS doesn't have the keys yet
  if (!(number in STOCK_LEVELS)) {
    STOCK_LEVELS[number] = 'full'
    console.debug(`Added ${number} before updating`)
  }

  if (STOCK_LEVELS[number] === 'full') {
    if (LOW_ENABLE === true) {
      confirmUpdate('low')
    } else {
      confirmUpdate('empty')
    }
  } else if (STOCK_LEVELS[number] === 'low') {
    confirmUpdate('empty')
  } else if (STOCK_LEVELS[number] === 'empty') {
    confirmUpdate('full')
  }
}

/**
 * This uses {@link setColour} to change the colour of the button,
 * then updates {@link STOCK_LEVELS} with the level.
 * @param {number} number The button number to update
 * @param {levelValues} level The level to set
 */
export function updateLevel(number, level) {
  const button = document.getElementById(`button_${number}`)
  setColour(number, level, button)

  if (level === 'empty') {
    console.log(`Setting ${number} as empty`)
    STOCK_LEVELS[number] = 'empty'
  } else if (level === 'low') {
    console.log(`Setting ${number} as low`)
    STOCK_LEVELS[number] = 'low'
  } else if (level === 'full') {
    console.log(`Setting ${number} as full`)
    STOCK_LEVELS[number] = 'full'
  }
}

// ---------------------------------------------------------------------------
// History functions
// --------------------------------------------------------------------------
/**
 * Function that creates a div with info about about a recent changes
 * and adds it to the history div.
 *
 * Uses {@link setTooltip} {@link setColour}
 * @param {singleUpdateObj} stock_level
 */
export function updateHistory(stock_level) {
  console.log(stock_level)
  const div = document.createElement('div')
  div.classList.add('update')
  div.innerHTML = `<div class="time">${stock_level.time}</div>
                   <div class="name">${stock_level.name}</div>
                   <div class="number">${stock_level.number}</div>
                   <div class="level">${stock_level.level}</div>`

  setTooltip(stock_level.number, div)
  setColour(stock_level.number, stock_level.level, div)

  document.getElementById('history').prepend(div)
}

// ---------------------------------------------------------------------------
// Settings functions
// ---------------------------------------------------------------------------
/**
 * Set every beer as empty, low or full.
 * @param {levelValues} level
 */
export function updateAllAs(level) {
  if (!AUTHORISED) return
  if (confirm(`Are you sure you want to mark everything as ${level}?`) !== true) return

  console.log(`Marking everything as ${level}`)
  /** @type{stockLevelsObj} */
  const table = {}
  for (let number = 1; number <= NUM_OF_BUTTONS; number++) {
    table[number] = level
  }
  socket.emit('replace-all', table)
  STOCK_LEVELS = table
}

/**
 * This creates a hidden element that pops up an upload dialog that allows
 * sending the a previous state to the server for distribution.
 */
export function tableUpload() {
  if (!AUTHORISED) return
  const input_element = document.createElement('input')
  input_element.type = 'file'
  input_element.onchange = () => {
    const reader = new FileReader()
    const file = input_element.files[0]
    reader.onload = () => {
      // File type validation
      if (file.type !== 'application/json') {
        alert("Error: this file is not of the right type,\nplease upload a 'state.json' file")
        return
      }

      // File size validation
      if (file.size > 1032) {
        alert("Error: this file is too large,\nplease upload a valid 'state.json' file")
        return
      }

      // Data validation
      try {
        const data = JSON.parse(reader.result.toString())
        if (typeof data !== 'object' && data !== null) throw Error
      } catch (error) {
        alert("Error: could not parse JSON,\nplease upload a valid 'state.json' file")
        return
      }

      if (confirm('Are you sure you want to use this data?') !== true) return

      const newTable = JSON.parse(reader.result.toString())
      socket.emit('update-all', newTable)
      STOCK_LEVELS = newTable
    }

    reader.readAsText(file)
    console.log(`Reading in ${file.size} bytes from ${file.name}`)
  }
  input_element.click()
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
/**
 * Disable the will-change events on the buttons when the page is not open
 * This decreases the GPU usage from ~17MB to ~6MB when the tab is in the background.
 */
document.addEventListener('visibilitychange', () => {
  const allButtons = document.querySelectorAll('.button, .availability_button')

  if (document.visibilityState === 'visible') {
    console.debug('Enabling GPU offloading')
    allButtons.forEach((button) => (button.style.willChange = 'transform'))
  } else {
    console.debug('Disabling GPU offloading')
    allButtons.forEach((button) => (button.style.willChange = 'unset'))
  }
})

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------
socket.on('connect', () => {
  // Hide warning icon
  console.log('Server connected')
  document.getElementsByClassName('warning_icon')[0].style.display = 'none'
})

socket.on('disconnect', () => {
  // Display warning icon if the server has been disconnected for over 2 seconds
  setTimeout(() => {
    if (socket.connected !== true) {
      console.log('%cServer disconnected!', 'color:red;')
      document.getElementsByClassName('warning_icon')[0].style.display = 'grid'
    }
  }, 2000)
})

socket.on('auth', (status) => {
  // Change the text of the login button depending of the state of AUTHORISED
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

socket.on('config', (configuration) => {
  // Check or un-check the checkboxes if updates are received
  const confirmCheck = document.getElementById('confirm_check')
  const lowCheck = document.getElementById('low_check')

  console.log('%cUpdating configuration from:', 'font-weight:bold;')
  console.log(configuration)
  if (configuration.confirm) {
    TO_CONFIRM = true
    if (confirmCheck) confirmCheck.checked = true
  } else {
    TO_CONFIRM = false
    if (confirmCheck) confirmCheck.checked = false
  }
  if (configuration.low_enable) {
    LOW_ENABLE = true
    if (lowCheck) lowCheck.checked = true
  } else {
    LOW_ENABLE = false
    if (lowCheck) lowCheck.checked = false
  }
})

socket.on('beers', (beerList) => {
  BEERS = beerList
})
