/* eslint-env browser */
/* global io */
'use strict'

export let AUTHORISED = false
export let TO_CONFIRM = true
export let LOW_ENABLE = false
export let BEERS = []
export let STOCK_LEVELS = {}
export const socket = io.connect(self.location.host)

const empty_colour = getComputedStyle(document.body).getPropertyValue('--empty-colour')
const low_colour = getComputedStyle(document.body).getPropertyValue('--low-colour')
const full_colour = getComputedStyle(document.body).getPropertyValue('--full-colour')

window.updateNumber = updateNumber
window.updateAllAs = updateAllAs
window.tableUpload = tableUpload

// ---------------------------------------------------------------------------
// Shared functions
// ---------------------------------------------------------------------------
export function setTooltip (number, element) {
  const thisBeer = BEERS[number - 1]
  if (thisBeer !== undefined) {
    let vegan = ''
    if (thisBeer.vegan === 'y') {
      vegan = '(Ve)'
    }
    let gluten_free = ''
    if (thisBeer.gluten_free === 'y') {
      gluten_free = '(GF)'
    }
    const header = `${thisBeer.beer_number} - ${thisBeer.beer_name} ${vegan} ${gluten_free}`
    const divider = '-'.repeat(header.length + 10)
    element.title = `${header}\n${divider}\n${thisBeer.brewer}\n${thisBeer.abv}\n${thisBeer.beer_style}\n${thisBeer.description}`
  }
}

export function setColour (level, element) {
  if (level === 'empty') {
    element.style.background = empty_colour
  }
  if (level === 'low') {
    element.style.background = low_colour
  }
  if (level === 'full') {
    element.style.background = full_colour
  }
}

// ---------------------------------------------------------------------------
// Buttons functions
// ---------------------------------------------------------------------------
function confirmUpdate (number, level, to_confirm = TO_CONFIRM) {
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
  socket.emit('update single', { number: number, level: level })
}

export function updateNumber (number) {
  if (!AUTHORISED) return
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

// Change the colour of the button depending on the stock level
export function updateLevel (number, level) {
  const button = document.getElementById(`button_${number}`)
  setColour(level, button)

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

// Update the table based on remote changes to the stock levels
export function updateFromState (stock_levels) {
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

// ---------------------------------------------------------------------------
// Settings functions
// ---------------------------------------------------------------------------
export function updateAllAs (level) {
  if (!AUTHORISED) return
  if (confirm(`Are you sure you want to mark everything as ${level}?`) !== true) return

  console.log(`Marking everything as ${level}`)
  const table = {}
  for (let i = 1; i <= 80; i++) {
    table[i] = level
  }
  socket.emit('update table', table)
  STOCK_LEVELS = table
}

export function tableUpload () {
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
        const data = JSON.parse(reader.result)
        if (typeof data !== 'object' && data !== null) throw Error
      } catch (error) {
        alert("Error: could not parse JSON,\nplease upload a valid 'state.json' file")
        return
      }

      if (confirm('Are you sure you want to use this data?') !== true) return
      updateRequired(JSON.parse(reader.result))
    }

    reader.readAsText(file)
    console.log(`Reading in ${file.size} bytes from ${file.name}`)
  }
  input_element.click()
}

function updateRequired (table) {
  for (const [number, level] of Object.entries(table)) {
    if (level !== STOCK_LEVELS[number]) {
      console.log(`Setting ${number} as ${level}`)
      socket.emit('update single', { number: Number(number), level: level })
      STOCK_LEVELS[number] = level
    }
  }
}

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------
socket.on('connect', () => {
  console.log('Server connected')
  document.getElementsByClassName('warning_icon')[0].style.display = 'none'
})

socket.on('disconnect', () => {
  window.setTimeout(() => {
    if (socket.connected !== true) {
      console.log('%cServer diconnected!', 'color:red;')
      document.getElementsByClassName('warning_icon')[0].style.display = 'grid'
    }
  }, 2000)
})

socket.on('auth', status => {
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

socket.on('config', configuration => {
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

socket.on('beers', beerList => {
  BEERS = beerList
})
