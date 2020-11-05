/* global fetch, L */

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
  //   num_of_beers  (number)
  //   beers         (array of objects with the following properties):
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
// Create map
const map = L.map('mapid')
map.setView([51.8012, -0.72515], 8)

// Add tile layer
const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: `&copy; <a href="https://www.openstreetmap.org/copyright" title="Open source map data">OpenStreetMap</a> contributors | 
                Icons by <a href="https://www.flaticon.com/authors/freepik" title="Free vector icons">Freepik</a> |
                Data from <a href="https://www.wikidata.org/" title="Free and open knowledge base">Wikidata</a> |
                GeoJSON from <a href="/downloads/breweries.geojson" title="GeoJSON file with brewery data">here</a>`
})
tileLayer.addTo(map)

// Add venue location
const venue = L.marker([51.8012, -0.72515], { icon: venueIcon })
venue.bindPopup('Aston Clinton Beer Festival')
venue.setZIndexOffset(1000)
venue.addTo(map)
venue.openPopup()

// Add the breweries with their labels
fetch('/downloads/breweries.geojson')
  .then((response) => response.json())
  .then((data) => {
    const breweries = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        return L.marker(latlng, {
          icon: breweryIcon,
          title: feature.properties.name,
          alt: feature.properties.name,
          riseOnHover: true
        })
      }
    })
    breweries.bindPopup((layer) => generateBreweryLabel(layer), { maxWidth: 500 })
    // map.fitBounds(breweries.getBounds(), { padding: [10, 10] })
    breweries.addTo(map)
  })
