/* eslint-env browser */
'use strict'

import { AUTHORISED, TO_CONFIRM, LOW_ENABLE, socket, updateAllAs, tableUpload } from './core.js'

let stock_levels = {}

const confirm_checkbox = document.getElementById('confirm_check')
const low_checkbox = document.getElementById('low_check')

confirm_checkbox.addEventListener('change', event => {
  if (AUTHORISED) {
    if (event.target.checked) {
      socket.emit('config', { confirm: true, low_enable: LOW_ENABLE })
    } else {
      socket.emit('config', { confirm: false, low_enable: LOW_ENABLE })
    }
  } else {
    confirm_checkbox.removeEventListener('change', event)
    console.log('confirm_checkbox is not allowed - not authenticated')
  }
})

low_checkbox.addEventListener('change', event => {
  if (AUTHORISED) {
    if (event.target.checked) {
      socket.emit('config', { low_enable: true, confirm: TO_CONFIRM })
    } else {
      socket.emit('config', { low_enable: false, confirm: TO_CONFIRM })
    }
  } else {
    low_checkbox.removeEventListener('change', event)
    console.log('low_checkbox is not allowed - not authenticated')
  }
})

// Update the state when remotes send updates
socket.on('update table', table => {
  console.log('%cUpdating table from:', 'font-weight:bold;')
  console.log(table)
  stock_levels = table
})

socket.on('update single', stock_level => {
  console.log(`Setting ${stock_level.number} as ${stock_level.level}`)
  stock_levels[stock_level.number] = stock_level.level
})
