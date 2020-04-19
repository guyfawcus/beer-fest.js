/* eslint-env browser */
'use strict'

import { socket } from './core.js'

socket.on('update single', stock_level => {
  console.log(stock_level)
  const div = document.createElement('div')
  div.classList.add('update')
  div.innerHTML = `<div class="time">${stock_level.time}</div>
                   <div class="name">${stock_level.name}</div>
                   <div class="number">${stock_level.number}</div>
                   <div class="level">${stock_level.level}</div>`
  document.getElementById('history').prepend(div)
})
