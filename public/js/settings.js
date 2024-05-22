/* eslint-env browser */

import { AUTHORISED, TO_CONFIRM, LOW_ENABLE, socket, tableUpload, beersUpload, updateAllAs } from './core.js'

const stateUploadButton = document.getElementById('stateUploadButton')
const beersUploadButton = document.getElementById('beersUploadButton')
const fullButton = document.getElementById('fullButton')
const lowButton = document.getElementById('lowButton')
const emptyButton = document.getElementById('emptyButton')
const confirm_checkbox = document.getElementById('confirm_check')
const low_checkbox = document.getElementById('low_check')

stateUploadButton.addEventListener('click', (event) => tableUpload())
beersUploadButton.addEventListener('click', (event) => beersUpload())
fullButton.addEventListener('click', (event) => updateAllAs('full'))
lowButton.addEventListener('click', (event) => updateAllAs('low'))
emptyButton.addEventListener('click', (event) => updateAllAs('empty'))

confirm_checkbox.addEventListener('change', (event) => {
  if (!AUTHORISED) return
  if (event.target.checked) {
    socket.emit('config', { confirm: true, low_enable: LOW_ENABLE })
  } else {
    socket.emit('config', { confirm: false, low_enable: LOW_ENABLE })
  }
})

low_checkbox.addEventListener('change', (event) => {
  if (!AUTHORISED) return
  if (event.target.checked) {
    socket.emit('config', { low_enable: true, confirm: TO_CONFIRM })
  } else {
    socket.emit('config', { low_enable: false, confirm: TO_CONFIRM })
  }
})
