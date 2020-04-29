/* eslint-env browser */
'use strict'

import { AUTHORISED, TO_CONFIRM, LOW_ENABLE, socket } from './core.js'

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