/* eslint-env browser */
/* global io */
'use strict'

export let AUTHORISED = false
export let TO_CONFIRM = true
export let LOW_ENABLE = false
export let BEERS = []
export const stock_levels = {}
export const socket = io.connect(self.location.host)

const empty_colour = getComputedStyle(document.body).getPropertyValue('--empty-colour')
const low_colour = getComputedStyle(document.body).getPropertyValue('--low-colour')
const full_colour = getComputedStyle(document.body).getPropertyValue('--full-colour')

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
export function updateLevel (number, level) {
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
