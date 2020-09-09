// More info about configuration & plugins:
// - https://revealjs.com/config/
// - https://revealjs.com/plugins/]

import Reveal from './reveal.esm.js'

// NOTE: Because most of the slides use the data-background attribute,
//       a lot of these settings won't actually change anything.
//
//       For example, changing the transition to 'zoom'
//       will only affect the actual content, not the background.

Reveal.initialize({
  preloadIframes: true,
  autoSlideStoppable: false,
  progress: false,
  controls: false,
  loop: true,
  keyboard: false,
  transition: 'fade',
  transitionSpeed: 'default'
})

Reveal.configure({
  autoSlide: 2000
})
