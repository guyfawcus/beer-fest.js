/* eslint-env browser */
/* global io */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "table" }] */
'use strict'

const socket = io.connect(self.location.host)
let stock_levels = {}
let TO_CONFIRM = true
let LOW_ENABLE = false
let AUTHORISED = false

const tableFill = () => {
  if (AUTHORISED) {
    if (TO_CONFIRM) {
      if (confirm('Are you sure you want to mark everything as full?') !== true) return
    }
    console.log('Filling everything 🍻')
    const table = {}
    for (let i = 1; i <= 80; i++) {
      table[i] = 'full'
    }
    socket.emit('update table', JSON.stringify(table))
    stock_levels = table
  } else {
    console.log('tableFill is not allowed - not authenticated')
  }
}

const tableLow = () => {
  if (AUTHORISED) {
    if (TO_CONFIRM) {
      if (confirm('Are you sure you want to mark everything as low?') !== true) return
    }
    console.log('Lowering everything')
    const table = {}
    for (let i = 1; i <= 80; i++) {
      table[i] = 'low'
    }
    socket.emit('update table', JSON.stringify(table))
    stock_levels = table
  } else {
    console.log('tableLow is not allowed - not authenticated')
  }
}

const tableEmpty = () => {
  if (AUTHORISED) {
    if (TO_CONFIRM) {
      if (confirm('Are you sure you want to mark everything as empty?') !== true) return
    }
    console.log('Emptying everything 😧')
    const table = {}
    for (let i = 1; i <= 80; i++) {
      table[i] = 'empty'
    }
    socket.emit('update table', JSON.stringify(table))
    stock_levels = table
  } else {
    console.log('tableEmpty is not allowed - not authenticated')
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
  for (const [button_number, stock_level] of Object.entries(table)) {
    if (stock_level !== stock_levels[button_number]) {
      console.log(`Setting ${button_number} as ${stock_level}`)
      socket.emit('update single', { number: button_number, level: stock_level })
      stock_levels[button_number] = stock_level
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

socket.on('config', configuration => {
  console.log('%cUpdating configuration from:', 'font-weight:bold;')
  console.log(configuration)
  if (configuration.confirm) {
    TO_CONFIRM = true
    document.getElementById('confirm_check').checked = true
  } else {
    TO_CONFIRM = false
    document.getElementById('confirm_check').checked = false
  }
  if (configuration.low_enable) {
    LOW_ENABLE = true
    document.getElementById('low_check').checked = true
  } else {
    LOW_ENABLE = false
    document.getElementById('low_check').checked = false
  }
})

// Update the state when remotes send updates
socket.on('update table', table => {
  console.log('%cUpdating table from:', 'font-weight:bold;')
  console.log(JSON.parse(table))
  stock_levels = JSON.parse(table)
})

socket.on('update single', stock_level => {
  console.log(`Setting ${stock_level.number} as ${stock_level.level}`)
  stock_levels[stock_level.number] = stock_level.level
})

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
  if (status) {
    AUTHORISED = true
    console.log('Authenticated with server')
  } else {
    AUTHORISED = false
    console.log('Not authenticated')
  }
})
