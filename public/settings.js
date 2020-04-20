/* eslint-env browser */
'use strict'

import { AUTHORISED, TO_CONFIRM, LOW_ENABLE, socket } from './core.js'

let stock_levels = {}

const updateAllAs = level => {
  if (AUTHORISED) {
    if (TO_CONFIRM) {
      if (confirm(`Are you sure you want to mark everything as ${level}?`) !== true) return
    }
    console.log(`Marking everything as ${level}`)
    const table = {}
    for (let i = 1; i <= 80; i++) {
      table[i] = level
    }
    socket.emit('update table', table)
    stock_levels = table
  } else {
    console.log('updateAllAs is not allowed - not authenticated')
  }
}

const tableUpload = () => {
  if (AUTHORISED) {
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

        if (TO_CONFIRM) {
          if (confirm('Are you sure you want to use this data?') !== true) return
        }
        updateRequired(JSON.parse(reader.result))
      }

      reader.readAsText(file)
      console.log(`Reading in ${file.size} bytes from ${file.name}`)
    }
    input_element.click()
  } else {
    console.log('tableUpload is not allowed - not authenticated')
  }
}

const updateRequired = table => {
  for (const [number, level] of Object.entries(table)) {
    if (level !== stock_levels[number]) {
      console.log(`Setting ${number} as ${level}`)
      socket.emit('update single', { number: number, level: level })
      stock_levels[number] = level
    }
  }
}

const confirm_checkbox = document.getElementById('confirm_check')

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

const low_checkbox = document.getElementById('low_check')

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

window.updateAllAs = updateAllAs
window.tableUpload = tableUpload
