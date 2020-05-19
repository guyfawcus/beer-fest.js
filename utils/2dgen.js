#!/usr/bin/env node

/**
 * This function will output XML that can be added to a .qxw file for QLC+
 * It lays out a grid of 80 fixtures in a 10 x 8 matrix for the 2D View of the Fixture Monitor
 */
function generateFixtureMonitorXML() {
  let XMLOutput = `  <Monitor DisplayMode="1" ShowLabels="0">
   <Font>Arial,12,-1,5,50,0,0,0,0,0</Font>
   <ChannelStyle>0</ChannelStyle>
   <ValueStyle>0</ValueStyle>
   <Grid Width="3" Height="3" Depth="2" Units="0"/>`

  let ID = 0
  let XPos = 0
  let YPos = 0

  for (let i = 1; i <= 80; i++) {
    ID = i - 1
    XPos += 250
    XMLOutput += `   <FxItem ID="${ID}" XPos="${XPos}" YPos="${YPos}"/>\n`

    if (i % 10 === 0) {
      XPos = 0
      YPos += 250
    }
  }
  console.log(XMLOutput.slice(0, -1))
}

generateFixtureMonitorXML()
