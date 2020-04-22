/* eslint-env browser */
'use strict'

import { setTooltip, socket, empty_colour, low_colour, full_colour } from './core.js'

let numberOfUpdates = 0

socket.on('update single', stock_level => {
  if (numberOfUpdates > 19) {
    const parentDiv = document.getElementById('history')
    const childDiv = parentDiv.getElementsByClassName('update')[19]
    parentDiv.removeChild(childDiv)
  }

  console.log(stock_level)
  const div = document.createElement('div')
  div.classList.add('update')
  div.innerHTML = `<div class="time">${stock_level.time}</div>
                   <div class="name">${stock_level.name}</div>
                   <div class="number">${stock_level.number}</div>
                   <div class="level">${stock_level.level}</div>`

  setTooltip(stock_level.number, div)

  if (stock_level.level === 'empty') {
    div.style.background = empty_colour
  }
  if (stock_level.level === 'low') {
    div.style.background = low_colour
  }
  if (stock_level.level === 'full') {
    div.style.background = full_colour
  }
  document.getElementById('history').prepend(div)
  numberOfUpdates += 1
})

socket.on('update table', stock_level => {
  document.getElementById('history').innerHTML = ''
  numberOfUpdates = 0
})

socket.on('beers', beerList => {
  // Update the existing entries' tooltips with the new information
  document.querySelectorAll('.update').forEach(element => {
    setTooltip(element.getElementsByClassName('number')[0].textContent, element)
  })
})
