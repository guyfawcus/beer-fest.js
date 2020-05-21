/* eslint-env browser */
'use strict'

import { AUTHORISED, TO_CONFIRM, LOW_ENABLE, socket, tableUpload, updateAllAs } from './core.js'

const uploadButton = document.getElementById('uploadButton')
const fullButton = document.getElementById('fullButton')
const lowButton = document.getElementById('lowButton')
const emptyButton = document.getElementById('emptyButton')
const confirm_checkbox = document.getElementById('confirm_check')
const low_checkbox = document.getElementById('low_check')

uploadButton.addEventListener('click', event => tableUpload())
fullButton.addEventListener('click', event => updateAllAs('full'))
lowButton.addEventListener('click', event => updateAllAs('low'))
emptyButton.addEventListener('click', event => updateAllAs('empty'))

confirm_checkbox.addEventListener('change', event => {
  if (!AUTHORISED) return
  if (event.target.checked) {
    socket.emit('config', { confirm: true, low_enable: LOW_ENABLE })
  } else {
    socket.emit('config', { confirm: false, low_enable: LOW_ENABLE })
  }
})

low_checkbox.addEventListener('change', event => {
  if (!AUTHORISED) return
  if (event.target.checked) {
    socket.emit('config', { low_enable: true, confirm: TO_CONFIRM })
  } else {
    socket.emit('config', { low_enable: false, confirm: TO_CONFIRM })
  }
})
