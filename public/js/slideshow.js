/* global globalThis */

// More info about config & dependencies:
// - https://github.com/hakimel/reveal.js#configuration
// - https://github.com/hakimel/reveal.js#dependencies]

globalThis.Reveal.initialize({
  preloadIframes: true,
  autoSlideStoppable: false,
  progress: false,
  controls: false,
  loop: true,
  keyboard: false,
  transition: 'fade',
  transitionSpeed: 'slow'
})

globalThis.Reveal.configure({
  autoSlide: 2000
})
