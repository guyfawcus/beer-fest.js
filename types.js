// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
/**
 * Object to store the configuration state
 * @typedef {object} configObj
 * @property {boolean} confirm
 * @property {boolean} low_enable
 */

/**
 * The different level values that can be used
 * @typedef {('empty'|'low'|'full')} levelValues
 */

/**
 * Object that stores information about each beer.
 * All of the optional properties are obtained from Wikidata.
 * @typedef {Object} beerObj
 * @property {string} beerObj.beer_number The number of the beer
 * @property {string} beerObj.beer_name The name of the beer
 * @property {string} beerObj.brewer The brewer of the beer
 * @property {string} beerObj.brewery_wikidata_id The Wikidata QID of the brewery
 * @property {string} beerObj.abv The alcohol by volume of the beer
 * @property {string} beerObj.beer_style The style of the beer
 * @property {string} beerObj.vegan 'y' if the beer is vegan
 * @property {string} beerObj.gluten_free 'y' if the beer is gluten free
 * @property {string} beerObj.description A description of the beer
 * @property {string} [beerObj.brewery_website] The brewery's website
 * @property {string} [beerObj.brewery_latitude] The brewery's latitude
 * @property {string} [beerObj.brewery_longitude] The brewery's longitude
 * @property {string} [beerObj.brewery_beer_advocate] The brewery's BeerAdvocate ID
 * @property {string} [beerObj.brewery_rate_beer] The brewery's RateBeer ID
 * @property {string} [beerObj.brewery_untappd] The brewery's Untappd ID
 * @property {string} [beerObj.brewery_facebook] The brewery's Facebook ID
 * @property {string} [beerObj.brewery_instagram] The brewery's Instagram username
 * @property {string} [beerObj.brewery_twitter] The brewery's Twitter username
 */

/**
 * Object to store the beer information for a range of beers. Used in {@link BEERS}
 * @typedef {Object.<number, beerObj>} beersObj
 */

/** Object to store the stock levels for a range of beers. Used in {@link STOCK_LEVELS}
 * @typedef {Object.<number, levelValues>} stockLevelsObj
 */

/** Object to store the stock level and other info for an update. Used in {@link updateHistory}
 * @typedef {object} singleUpdateObj
 * @property {number} epoch_time Time since the the Unix epoch that the update was performed
 * @property {string} name The name of the person who generated the update
 * @property {number} number The number of the beer that was changed
 * @property {levelValues} level The level that the beer is set to
 */
