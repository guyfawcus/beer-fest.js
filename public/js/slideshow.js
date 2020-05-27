// More info about configuration & plugins:
// - https://revealjs.com/config/
// - https://revealjs.com/plugins/]

import Reveal from './reveal.esm.js'

Reveal.initialize({
  preloadIframes: true,
  autoSlideStoppable: false,
  progress: false,
  controls: false,
  loop: true,
  keyboard: false,
  transition: 'fade',
  transitionSpeed: 'slow'
})

Reveal.configure({
  autoSlide: 2000
})
