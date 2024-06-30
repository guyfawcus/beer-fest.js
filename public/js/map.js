/* eslint-env browser */

import * as L from './leaflet-src.esm.js'
import { socket } from './core.js'

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------
const venueIcon = L.icon({
  iconUrl: 'icons/oktoberfest.svg',
  iconSize: [40, 40],
  popupAnchor: [0, -20]
})

const breweryIcon = L.icon({
  iconUrl: 'icons/placeholder.svg',
  iconSize: [35, 35],
  popupAnchor: [0, -17.5]
})

const hiddenBreweryIcon = L.icon({
  iconUrl: 'icons/hidden-placeholder.svg',
  iconSize: [35, 35],
  popupAnchor: [0, -17.5]
})

// This will contain all of the brewery points
let breweries = L.geoJSON()

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------
/**
 * This function will generate the text for the popup associated with each brewery
 * @param {Object} layer Object that contains all of the information for this point
 * @returns {string} Formatted string with brewery information
 */
function generateBreweryLabel(layer) {
  const brewery = layer.feature.properties
  // The available properties are:
  //   name
  //   wikidata_qid
  //   wikidata_url
  //   ----------------------
  //   website
  //   beer_advocate
  //   rate_beer
  //   untappd
  //   facebook
  //   instagram
  //   twitter
  //   ----------------------
  //   num_of_beers           (number)
  //   has_vegan_beers        (bool)
  //   has_gluten_free_beers  (bool)
  //   beers                  (array of objects with the following properties):
  //     number
  //     name
  //     abv
  //     style
  //     vegan
  //     gluten_free
  //     description

  // Format the the list of beer objects into a list of strings
  const beer_strings = brewery.beers.map((beer) => {
    const vegan = beer.vegan === 'y' ? ' (Ve)' : ''
    const glutenFree = beer.gluten_free === 'y' ? ' (GF)' : ''
    return `${beer.number} - ${beer.name}${vegan}${glutenFree}`
  })

  // Return the formatted string for use in the popup
  return `<b>${brewery.name}</b><br>
          <a href="${brewery.website}">${brewery.website}</a><br><br>
          ${beer_strings.join('<br>')}<br>`
}

/**
 * This function will refresh all of the brewery icons, 'hiding' them with a greyed-out icon if necessary.
 */
function refreshIcons() {
  const hide_not_vegan = localStorage.getItem('HIDE_NOT_VEGAN') === 'true'
  const hide_not_gluten_free = localStorage.getItem('HIDE_NOT_GLUTEN_FREE') === 'true'
  const showIcon = (brewery) => brewery.setIcon(breweryIcon).setZIndexOffset(0)
  const hideIcon = (brewery) => brewery.setIcon(hiddenBreweryIcon).setZIndexOffset(-1000)

  breweries.eachLayer((brewery) => {
    const has_vegan_beers = brewery.feature.properties.has_vegan_beers
    const has_gluten_free_beers = brewery.feature.properties.has_gluten_free_beers

    if ((hide_not_vegan && !has_vegan_beers) || (hide_not_gluten_free && !has_gluten_free_beers)) {
      hideIcon(brewery)
    } else {
      showIcon(brewery)
    }
  })
}

async function refresh_geojson() {
  try {
    const response = await fetch('/downloads/breweries.geojson')
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
    const data = await response.json()

    breweries = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        return L.marker(latlng, {
          icon: breweryIcon,
          title: feature.properties.name,
          alt: feature.properties.name,
          riseOnHover: true
        })
      }
    })
    refreshIcons()
    breweries.bindPopup((layer) => generateBreweryLabel(layer), { maxWidth: 500 })
    // map.fitBounds(breweries.getBounds(), { padding: [10, 10] })
    breweries.addTo(map)
  } catch (error) {
    console.error(error.message)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
// Create map
const map = L.map('mapid')
map.setView([51.8012, -0.72515], 8)

// Add tile layer
const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: `&copy; <a href="https://www.openstreetmap.org/copyright" title="Open source map data">OpenStreetMap</a> contributors |
                Icons by <a href="https://www.freepik.com/" title="Free vector icons">Freepik</a> |
                Data from <a href="https://www.wikidata.org/" title="Free and open knowledge base">Wikidata</a>
                (<a href="../brewery-wikidata-query" title="Wikidata query for the data">query</a>) |
                GeoJSON from <a href="/downloads/breweries.geojson" title="GeoJSON file with brewery data">here</a>`
})
tileLayer.addTo(map)

// Add venue location
const venue = L.marker([51.8012, -0.72515], { icon: venueIcon })
venue.bindPopup('Aston Clinton Beer Festival')
venue.setZIndexOffset(1000)
venue.addTo(map)
venue.openPopup()

// Update if there is a message sent to the 'beers' topic.
// This is so that a new file is uploaded, it will be automatically refreshed.
socket.on('beers', (beerList) => {
  console.debug('Updating brewery information')

  // Remove the last set of breweries to start from a clean slate
  map.removeLayer(breweries)

  // Add the breweries with their labels
  refresh_geojson()
})

// Refresh the icons if the 'hiding' options are changed
window.onstorage = (event) => {
  if (event.key === 'HIDE_NOT_VEGAN' || event.key === 'HIDE_NOT_GLUTEN_FREE') refreshIcons()
}
