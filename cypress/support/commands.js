// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
Cypress.Commands.add('login', () => {
  cy.request({
    method: 'POST',
    url: '/users',
    body: {
      name: 'Cypress',
      code: '12'
    }
  })
})

Cypress.Commands.add('logout', () => {
  cy.request({
    method: 'GET',
    url: '/logout'
  })
})

Cypress.Commands.add('checkStockLevel', (number, value) => {
  // This command just performs the following:
  //   cy.request(`/api/stock_levels/${number}`).its('body').should('include', value)
  //
  // However, it will retry the request if the value isn't what is expected
  // This is needed because the request function doesn't automatically retry like others,
  // and the API is the only reliable way to check that the value has been updated

  let retries = -1

  function makeRequest() {
    retries++
    return cy.request(`/api/stock_levels/${number}`).then((resp) => {
      try {
        expect(resp.body).to.equal(value)
      } catch (err) {
        cy.log(`Retry number ${retries}`)
        if (retries > 5) throw new Error(`Retried too many times (${retries})`)
        return makeRequest()
      }
      return resp
    })
  }

  return makeRequest()
})
