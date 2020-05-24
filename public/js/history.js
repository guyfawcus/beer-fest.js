/* eslint-env browser */
'use strict'

import { setTooltip, socket, updateHistory } from './core.js'

socket.on('update single', (stock_level) => {
  updateHistory(stock_level)
})

socket.on('update table', (stock_level) => {
  document.getElementById('history').innerHTML = ''
})

socket.on('update history', (history) => {
  document.getElementById('history').innerHTML = ''
  history.forEach((stock_level) => updateHistory(stock_level))
})

socket.on('beers', (beerList) => {
  // Update the existing entries' tooltips with the new information
  document.querySelectorAll('.update').forEach((element) => {
    setTooltip(Number(element.getElementsByClassName('number')[0].textContent), element)
  })
})
