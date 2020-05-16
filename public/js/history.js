/* eslint-env browser */
'use strict'

import { setTooltip, socket, setColour } from './core.js'

socket.on('update single', stock_level => {
  console.log(stock_level)
  const div = document.createElement('div')
  div.classList.add('update')
  div.innerHTML = `<div class="time">${stock_level.time}</div>
                   <div class="name">${stock_level.name}</div>
                   <div class="number">${stock_level.number}</div>
                   <div class="level">${stock_level.level}</div>`

  setTooltip(stock_level.number, div)
  setColour(stock_level.number, stock_level.level, div)

  document.getElementById('history').prepend(div)
})

socket.on('update table', stock_level => {
  document.getElementById('history').innerHTML = ''
})

socket.on('beers', beerList => {
  // Update the existing entries' tooltips with the new information
  document.querySelectorAll('.update').forEach(element => {
    setTooltip(Number(element.getElementsByClassName('number')[0].textContent), element)
  })
})
