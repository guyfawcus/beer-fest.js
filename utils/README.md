# Utilities

This folder contains several scripts to assist in the development and use of beer-fest.js

## [2dgen.js](utils/2dgen.js)

Generates and prints out some XML to be inserted into a [QLC+ save file](public/downloads/qlcplus.qxw).
The XML lays out a grid of fixtures for use in the 2D View of the [Fixture monitor](https://www.qlcplus.org/docs/html_en_EN/fixturemonitor.html).
You only need to re-run this you want to change the number of fixtures or layout of the view.

Visit the [/bridge](https://acbf-2020.herokuapp.com/bridge) page for more information.

```
  <Monitor DisplayMode="1" ShowLabels="0">
   <Font>Arial,12,-1,5,50,0,0,0,0,0</Font>
   <ChannelStyle>0</ChannelStyle>
   <ValueStyle>0</ValueStyle>
   <Grid Width="3" Height="3" Depth="2" Units="0"/>   <FxItem ID="0" XPos="250" YPos="0"/>
   <FxItem ID="1" XPos="500" YPos="0"/>
   <FxItem ID="2" XPos="750" YPos="0"/>
   <FxItem ID="3" XPos="1000" YPos="0"/>
   ...
```

<img src="/docs/images/qlc-plus-integration.png" width="384">

## [clean.sh](utils/clean.sh)

Cleans up to so that the app starts in a clean state:

- Wipes out the Redis database
- Wipes out the docs folder
- unsets the `ADMIN_CODE` and `COOKIE_SECRET` environment variables\*

\*Requires the command to be sourced e.g. `source ./utils/clean.sh`

## [codegen.js](utils/codegen.js)

Hashes a new admin code and generates a secure cookie secret, then tells you how to set them.

If you run it with the `--heroku` flag, it will send the variables to Heroku.

## [listSessions.js](utils/listSessions.js)

Lists the sessions that have connected to the server in the last 24 hours.

Passing a `redis://` URL as an argument will use that instead of defaulting to a local instance.

Tip - use [watch](https://linux.die.net/man/1/watch) to run this command every 60 seconds (so as not to tax the database)
and [head](https://www.gnu.org/software/coreutils/manual/html_node/head-invocation.html)
to return the 8 most recent connections (1 line of the summary, 1 blank line, 8 connections):

`watch -n 60 "./utils/listSessions.js 'redis://:secrets@example.com:1234' | head -n 10"`

## [python_websockets_example.ipynb](utils/python_websockets_example.ipynb)

A [Jupyter notebook](https://jupyter.org/) with examples for using the websocket events directly in Python.

## [request.rest](utils/request.rest)

For use with the [REST client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) for Visual Studio Code,
makes it easy to test calls to the API (requires the API to be enabled - see the [development docs](docs/development.md#environment-variables)).
