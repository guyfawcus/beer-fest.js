/* eslint-env browser */
'use strict'

import { socket } from './core.js'

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
  document.getElementById('history').prepend(div)
  numberOfUpdates += 1
})
