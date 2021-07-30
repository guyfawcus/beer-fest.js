// More info about configuration & plugins:
// - https://revealjs.com/config/
// - https://revealjs.com/plugins/]

import Reveal from './reveal.esm.js'

Reveal.initialize({
  preloadIframes: true,
  viewDistance: 10,
  autoSlideStoppable: false,
  progress: false,
  controls: false,
  loop: true,
  keyboard: false,
  transition: 'fade',
  backgroundTransition: 'fade',
  transitionSpeed: 'default'
})

Reveal.configure({
  autoSlide: 5000
})
