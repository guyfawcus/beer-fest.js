/* eslint-env browser */
'use strict'

import { socket, updateHistory } from './core.js'

let historyLog = []

socket.on('update-single', (stock_level) => {
  console.debug('Socket event: update-single')
  historyLog.push(stock_level)
  updateHistory(stock_level)
})

socket.on('replace-all', (stock_level) => {
  console.debug('Socket event: replace-all')
  historyLog = []
  document.getElementById('history').innerHTML = ''
})

socket.on('history', (history) => {
  console.debug('Socket event: history')
  document.getElementById('history').innerHTML = ''

  console.groupCollapsed('Updating all entities')
  historyLog = []
  history.forEach((stock_level) => {
    historyLog.push(stock_level)
    updateHistory(stock_level)
  })
  console.groupEnd()
})

socket.on('beers', (beerList) => {
  console.debug('Socket event: beers')
  document.getElementById('history').innerHTML = ''

  console.groupCollapsed('Updating all entities')
  historyLog.forEach((stock_level) => {
    updateHistory(stock_level)
  })
  console.groupEnd()
})

// Update this page if changes are made to another one on the same device
window.onstorage = (event) => {
  if (event.key === 'HIDE_NO_INFORMATION' || event.key === 'HIDE_NOT_VEGAN' || event.key === 'HIDE_NOT_GLUTEN_FREE') {
    console.debug('Window event: storage')
    document.getElementById('history').innerHTML = ''

    console.groupCollapsed('Updating all entities')
    historyLog.forEach((stock_level) => {
      updateHistory(stock_level)
    })
    console.groupEnd()
  }
}
