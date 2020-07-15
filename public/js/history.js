/* eslint-env browser */
'use strict'

import { socket, updateHistory } from './core.js'

let historyLog = []

socket.on('update-single', (stock_level) => {
  historyLog.push(stock_level)
  updateHistory(stock_level)
})

socket.on('replace-all', (stock_level) => {
  historyLog = []
  document.getElementById('history').innerHTML = ''
})

socket.on('history', (history) => {
  document.getElementById('history').innerHTML = ''
  history.forEach((stock_level) => {
    historyLog.push(stock_level)
    updateHistory(stock_level)
  })
})

socket.on('beers', (beerList) => {
  document.getElementById('history').innerHTML = ''
  historyLog.forEach((stock_level) => {
    updateHistory(stock_level)
  })
})
