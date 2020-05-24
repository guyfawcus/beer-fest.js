/* eslint-env browser */
/* global globalThis */
'use strict'

/** `true` is a user is logged in */
export let AUTHORISED = false

/** `true` if the confimation window should pop up before an update */
export let TO_CONFIRM = true

/** `true` if the middle 'low' level is to be used as a state */
export let LOW_ENABLE = false

/**
 * A list of [beer objects]{@link beersObj} containing inforamtion for each beer
 * @type{beersObj[]}
 */
export let BEERS = []

/**
 * Simple key value store that conforms to {@link stockLevelsObj},
 * where a number is the key and a [level]{@link levelValues} is the value
 * @type{stockLevelsObj}
 */
export let STOCK_LEVELS = {}

/** The socket.io socket object */
export const socket = globalThis.io.connect(self.location.host)

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
 * @typedef {Object.<number, levelValues>} stockLevelsObj
 */

// ---------------------------------------------------------------------------
// Shared functions
// ---------------------------------------------------------------------------
/**
 * Function that updates the tooltip for the selected number
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
 * Function to change the backgound colour of an element depending on the level.
 * @param {number} number The number to be updated
 * @param {levelValues} level The level that the element is to be changed to. If this is undefined, the last level will be used
 * @param {HTMLElement} element The element whose background is to be changed
 * This can't be inferred from the number because this function is used in other places,
 * namely the history page, where the div doesn't have an ID in the format `button_<number>`
 */
export function setColour(number, level, element) {
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
// Buttons functions
// ---------------------------------------------------------------------------
/**
 * Simple wrapper function that pops up a confirmation window if required.
 * The update is then passed to {@link updateLevel}.
 * @param {number} number The number to be updated
 * @param {levelValues} level The level that the number will be set to
 * @param {boolean} [to_confirm = TO_CONFIRM] If set to `true`, a pop-up will appear asking the user to confirm the action
 */
function confirmUpdate(number, level, to_confirm = TO_CONFIRM) {
  const button = document.getElementById(`button_${number}`)

  if (to_confirm) {
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
  setColour(number, level, button)
  socket.emit('update single', { number: number, level: level })
}

/**
 * This function generates an SVG cross and adds it to an element
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
 */
function setCross(number, checked = true) {
  const button = document.getElementById(`button_${number}`)
  const cross = button.getElementsByClassName('cross')[0]

  if (checked === false) {
    cross.classList.remove('checked')
    localStorage.removeItem(number.toString())
  } else {
    cross.classList.add('checked')
    localStorage.setItem(number.toString(), 'checked')
  }
}

/**
 * This simple wrapper function just runs
 * {@link setTooltip} and {@link setColour} every button.
 */
export function rereshButtons() {
  const transitionTime = getComputedStyle(document.body).getPropertyValue('--transition-time')

  for (let i = 1; i <= 80; i++) {
    const button = document.getElementById(`button_${i}`)

    // Deactivate transitions because transitioning everything causes jank on mobile
    button.style.transition = 'none'
    setTooltip(i, button)
    setColour(i, undefined, button)
    // Restore transitions - setTimeout of 0 is needed to make sure the call stack is clear
    setTimeout(() => (button.style.transition = `all ${transitionTime}`), 0)
  }
}

/**
 * This loops over all of the entries in local storage see what numbers are checked.
 * It then makes an array of Uint8 bytes where each bit represents the checked state of a number,
 * for example, if the first byte was `0b01001011` (`0x4a`) then numbers 2, 5, 7 and 8 are checked.
 * It returns the the array formatted as base-16 hex so that it can be used in a URL.
 * @returns {string} hex formatted string
 */
function generateCheckedHexData() {
  const checkedData = new Uint8Array(10)
  let byteNum = 0
  let bitNum = 0

  for (let number = 1; number <= 80; number++) {
    const checked = localStorage.getItem(number.toString())

    // Set the bit if the number is checked
    if (checked) checkedData[byteNum] |= 1 << (7 - bitNum)

    if (number % 8 === 0) {
      byteNum += 1
      bitNum = 0
    } else {
      bitNum++
    }
  }

  const checkedHexData = checkedData.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
  return checkedHexData
}

/**
 * This uses {@link generateCheckedHexData} and adds the result to a URL.
 * This is used if you want to share the numbers that you've checked off with somone / back them up.
 * @param {boolean} [updateURL] If set to `true`, the URL of the page will be updated with the result
 * @returns {URL} The full URL including the checked hex data as a search parameter
 */
export function generateCheckedHexURL(updateURL = false) {
  const checkedHexData = generateCheckedHexData()
  const url = new URL(window.location.href)
  url.searchParams.set('checked', checkedHexData)
  if (updateURL) history.replaceState(null, '', url.toString())
  return url
}

/**
 * This parses the checkedHexData and adds the crosses on the buttons using setCross().
 * @param {string} checkedHexData A hex formatted string containg the checked data
 * @returns {number[] | undefined} A list of all of the numbers that are checked
 */
export function parseCheckedHexData(checkedHexData) {
  // Make sure the input is the right length 10 bytes (20 nibbles)
  if (!checkedHexData) {
    return
  } else if (checkedHexData.length < 20) {
    console.debug(`Padding checkedHexData (${checkedHexData}) with ${20 - checkedHexData.length} nibble(s)`)
    checkedHexData = checkedHexData.padEnd(20, '0')
  } else if (checkedHexData.length > 20) {
    console.debug(
      `Trimming ${checkedHexData.length - 20} nibble(s) from checkedHexData (${checkedHexData.slice(
        checkedHexData.length - 20
      )})`
    )
    checkedHexData = checkedHexData.slice(0, 20)
  }

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
 * Takes a list of the numbers checked using {@link parseCheckedHexData} then sets them using {@link setCross}
 * @param {array} numbersChecked The numbers checked
 */
export function applyChecks(numbersChecked) {
  for (let number = 1; number <= 80; number++) {
    if (numbersChecked.includes(number)) {
      setCross(number)
    } else {
      setCross(number, false)
    }
  }
}

/**
 * Simple wrapper that loops over all of the numbers in local storage, then sets
 * the crosses with {@link setCross} if they are checked or removes them if not
 */
export function updateChecked() {
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
 * If a user is logged in ({@link AUTHORISED}) then this will update the level of the beer using {@link confirmUpdate}.
 * If not, then the number will be checked off (a cross will be added / removed using {@link setCross}
 * @param {number} number The number to update the level of / set the cross
 */
export function updateNumber(number) {
  if (!AUTHORISED) {
    // If the number has a cross on it already, remove it. Otherwise, set it.
    const button = document.getElementById(`button_${number}`)
    const cross = button.getElementsByClassName('cross')[0]
    if (cross.classList.contains('checked')) {
      setCross(number, false)
    } else {
      setCross(number)
    }
    return
  }

  if (STOCK_LEVELS[number] === 'full') {
    if (LOW_ENABLE === true) {
      confirmUpdate(number, 'low')
    } else {
      confirmUpdate(number, 'empty')
    }
  } else if (STOCK_LEVELS[number] === 'low') {
    confirmUpdate(number, 'empty')
  } else if (STOCK_LEVELS[number] === 'empty') {
    confirmUpdate(number, 'full')
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

/**
 * Update the table based on remote changes to the stock levels
 * @param {stockLevelsObj} stock_levels
 */
export function updateFromState(stock_levels) {
  console.log('%cUpdating table from:', 'font-weight:bold;')
  console.log(stock_levels)
  for (const number in stock_levels) {
    if (stock_levels[number] === 'empty') {
      updateLevel(Number(number), 'empty')
    } else if (stock_levels[number] === 'low') {
      updateLevel(Number(number), 'low')
    } else if (stock_levels[number] === 'full') {
      updateLevel(Number(number), 'full')
    }
  }
}

// ---------------------------------------------------------------------------
// Settings functions
// ---------------------------------------------------------------------------
/**
 * Set every beer as empty, low or full
 * @param {levelValues} level
 */
export function updateAllAs(level) {
  if (!AUTHORISED) return
  if (confirm(`Are you sure you want to mark everything as ${level}?`) !== true) return

  console.log(`Marking everything as ${level}`)
  /** @type{stockLevelsObj} */
  const table = {}
  for (let i = 1; i <= 80; i++) {
    table[i] = level
  }
  socket.emit('update table', table)
  STOCK_LEVELS = table
}

/**
 * This creates a hidden element that pops up an upload dialog that allows
 * sending the a previous state to the server for distribution
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
      updateRequired(JSON.parse(reader.result.toString()))
    }

    reader.readAsText(file)
    console.log(`Reading in ${file.size} bytes from ${file.name}`)
  }
  input_element.click()
}

/**
 * This is used by {@link tableUpload} to only update the beers that are different from the current state
 * @param {stockLevelsObj} table
 */
function updateRequired(table) {
  for (const [number, level] of Object.entries(table)) {
    if (level !== STOCK_LEVELS[number]) {
      console.log(`Setting ${number} as ${level}`)
      socket.emit('update single', { number: Number(number), level: level })
      STOCK_LEVELS[number] = level
    }
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
/**
 * Disable the will-change events on the buttons when the page is not open
 * This decreases the GPU usage from ~17MB to ~6MB when the tab is in the background
 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.debug('Enabling GPU offloading')
    const buttons = document.getElementsByClassName('button')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].style.willChange = 'transform'
    }
    const availability_buttons = document.getElementsByClassName('availability_button')
    for (let i = 0; i < availability_buttons.length; i++) {
      availability_buttons[i].style.willChange = 'transform'
    }
  } else {
    console.debug('Disabling GPU offloading')
    const buttons = document.getElementsByClassName('button')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].style.willChange = 'unset'
    }
    const availability_buttons = document.getElementsByClassName('availability_button')
    for (let i = 0; i < availability_buttons.length; i++) {
      availability_buttons[i].style.willChange = 'unset'
    }
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
  // Display warning icon if the server has been disonnected for over 2 seconds
  window.setTimeout(() => {
    if (socket.connected !== true) {
      console.log('%cServer diconnected!', 'color:red;')
      document.getElementsByClassName('warning_icon')[0].style.display = 'grid'
    }
  }, 2000)
})

socket.on('auth', (status) => {
  // Change the test of the login button depending of the state of AUTHORISED
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
  // Check or un-check the checkboxes if updates are recieved
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
