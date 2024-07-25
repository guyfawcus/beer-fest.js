const slides = document.getElementById('slideshow').children
const availability_iframe = document.getElementById('availability-iframe')
const other_availability_iframe = document.getElementById('other-availability-iframe')

let slideIndex = 0
carousel()

function carousel() {
  // Hide all slides
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = 'none'
  }
  availability_iframe.style.display = 'none'
  other_availability_iframe.style.display = 'none'

  // Increase the slide index on this run
  slideIndex++

  // Start again if we're at the end
  if (slideIndex > slides.length) slideIndex = 1

  // Display this slide
  const current_slide = slides[slideIndex - 1]

  // Run this function (change the slide) every 5 seconds if it's an image
  if (current_slide.nodeName === 'IMG') {
    current_slide.style.display = 'block'
    setTimeout(carousel, 5000)
  }
  if (current_slide.classList.contains('availability')) {
    availability_iframe.style.display = 'block'
    setTimeout(carousel, 8000)
  }

  if (current_slide.classList.contains('other-availability')) {
    other_availability_iframe.style.display = 'block'
    setTimeout(carousel, 6000)
  }
}

// Disable the cursor on the sponsor sides
document.addEventListener('DOMContentLoaded', () => {
  document.body.style = 'cursor: none;'
})

// Disable the cursor on the availability slides
availability_iframe.onload = () => {
  availability_iframe.contentDocument.body.style.cursor = 'none'
  availability_iframe.contentDocument.querySelector('#buttons_header').style.cursor = 'none'
}
other_availability_iframe.onload = () => {
  other_availability_iframe.contentDocument.body.style.cursor = 'none'
  other_availability_iframe.contentDocument.querySelector('#buttons_header').style.cursor = 'none'
}
