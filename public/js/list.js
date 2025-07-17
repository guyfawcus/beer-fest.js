import { socket, updateList } from './core.js'

socket.on('beers', (beerList) => {
  console.debug('Socket event: beers')
  updateList(beerList)
})

// Update this page if changes are made to another one on the same device
window.onstorage = (event) => {
  if (event.key === 'HIDE_NOT_VEGAN' || event.key === 'HIDE_NOT_GLUTEN_FREE') {
    console.debug('Window event: storage')
  }
}
