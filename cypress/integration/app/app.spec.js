// Running these test on every button would take ages so restrict the range to:
const numbersToTest = [1, 80]

describe("General tests for the 'Availability' page", () => {
  beforeEach(() => {
    cy.visit('/availability')
    cy.log(`Checking numbers: ${numbersToTest}`)
  })

  it('Checks the button number text is correct', () => {
    numbersToTest.forEach((number) => {
      cy.get(`#button_${number}`).contains(`${number}`)
    })
  })

  it('Checks that a cross SVG is present on the button and that the ID numbers match', () => {
    numbersToTest.forEach((number) => {
      cy.get(`#button_${number}`).should('have.descendants', 'svg')
      cy.get(`#cross_${number}`).parent().should('have.id', `button_${number}`)
    })
  })
})

describe('Non-logged-in user tests', () => {
  beforeEach(() => {
    cy.visit('/availability')
    cy.log(`Checking numbers: ${numbersToTest}`)
  })

  it('Checks that the cross appears when a button is pressed and disappears when pressed again', () => {
    numbersToTest.forEach((number) => {
      cy.get(`#button_${number}`).as('button')
      cy.get(`#cross_${number}`).as('cross')
      cy.get('@cross').should('not.have.class', 'checked')
      cy.get('@button').click()
      cy.get('@cross').should('have.class', 'checked')
      cy.get('@button').click()
      cy.get('@cross').should('not.have.class', 'checked')
    })
  })
})

describe('Logged-in user tests', () => {
  beforeEach(() => {
    cy.visit('/availability')
    cy.log(`Checking numbers: ${numbersToTest}`)
    cy.login()
  })

  afterEach(() => {
    cy.logout()
  })

  it('Checks that the button cycles trough low then empty', () => {
    numbersToTest.forEach((number) => {
      cy.get(`#button_${number}`).as('button')

      cy.checkStockLevel(number, 'full')
      cy.get('@button').click()
      cy.checkStockLevel(number, 'low')
      cy.get('@button').click()
      cy.checkStockLevel(number, 'empty')
      cy.get('@button').click()
      cy.checkStockLevel(number, 'full')
    })
  })
})
