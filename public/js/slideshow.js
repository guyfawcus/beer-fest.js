const slides = document.getElementById('slideshow').children

let slideIndex = 0
carousel()

function carousel() {
  // Hide all slides
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = 'none'
  }

  // Increase the slide index on this run
  slideIndex++

  // Start again if we're at the end
  if (slideIndex > slides.length) slideIndex = 1

  // Display this slide
  const current_slide = slides[slideIndex - 1]
  current_slide.style.display = 'block'

  // Run this function (change the slide) every 5 seconds if it's an image
  if (current_slide.nodeName === 'IMG') {
    setTimeout(carousel, 5000)
  } else {
    setTimeout(carousel, 10000)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Disable the cursor on the sponsor sides
  document.body.style = 'cursor: none;'

  // Disable the cursor on the availability slide
  const iframe = document.querySelector('#slideshow_iframe')
  iframe.onload = () => {
    iframe.contentDocument.querySelector('#buttons_header').style.cursor = 'none'
  }
})
