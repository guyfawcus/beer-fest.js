/* global globalThis */

// More info about configuration & plugins:
// - https://revealjs.com/config/
// - https://revealjs.com/plugins/]

const deck = new globalThis.Reveal()

deck.initialize({
  preloadIframes: true,
  autoSlideStoppable: false,
  progress: false,
  controls: false,
  loop: true,
  keyboard: false,
  transition: 'fade',
  transitionSpeed: 'slow'
})

deck.configure({
  autoSlide: 2000
})
