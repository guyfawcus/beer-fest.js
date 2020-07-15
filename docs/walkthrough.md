# Walkthrough

This document will walk you through every page and describe their functionality.

## Homepage

<img src="/docs/images/homepage.png" width="384">

- **Log in** - Required to access the settings page and to edit the availability of the beers
- **Settings** - Various admin functions related to updating the state of the beers
- **Downloads** - Various files related to the festival like the list of beers
- **Availability** - Displays the availability of all of the beers
- **Slideshow** - Displays the availability page among other slides in a loop
- **History** - Displays a list of recent changes

## Login

<img src="/docs/images/login.png" width="384">

Not much to say about this one. It's where you log in.
Without doing this, you won't be able to get to the settings page or to change the availability of a beer.

The name does not need to be unique or to be pre-registered. It is only used for logging purposes but is publicly visible as it's sent along with every level update, so think twice before using a funny name!

There is only one code and it is set up before the event. It can be changed mid-event but it requires the assistance of the admin. Don't leave it lying around on a Post-it note!

## Settings

<img src="/docs/images/settings.png" width="384">

The settings page is only accessible to logged in users. The four main functions are beer information management, state management, resetting, and configuration.

- **Upload** - Allows uploading new beer information. This will update the tooltips and Ve/GF hide states for every connected client and replace `/downloads/current-beers.csv`.
  (Note: You can upload an empty file with a `.csv` extension to clear the current information)
- **Download** - Downloads the current beer information from `/downloads/current-beers.csv`.

- **Upload** - Allows uploading a previous state. This will cause the beers to be updated one-by-one so if you want a fresh start, use one of the reset buttons first (set all as _x_).
- **Download** - Makes a call to the API at `/api/stock_levels` and initiates a download of the resulting JSON. This can be uploaded later or stored for future reference.

- **Full / Low / Empty** - Sets every single beer as one of these levels and resets (clears) the history

- **Confirmations** - Enables or disables the confirmation checks when updating the level of a beer. Disabling this is not recommended.
- **'Low' level enable** - Enables or disables the 'low' level in the update cycle. For example, if this is disabled and a beer is 'full', then clicking on it will bypass 'low' and go straight to 'empty'.

## Downloads

<img src="/docs/images/downloads.png" width="384">

This page contains the beer information spreadsheet as well as the `.csv` files for each year that are exported from it.
The `.csv` file can be uploaded (`Settings` -> `Beer Information` -> `Upload`) and is used to display information about each beer on the 'Availability' and 'History' pages and 'hide' any non Ve/GF beers (if set).

## Availability

<img src="/docs/images/availability.png" width="384"> <img src="/docs/images/availability-menu.png" width="384">

The main attraction! This page displays the status of each beer. It will behave differently if you're logged-in or not.

- **Logged-in users** - Clicking a on a number will cycle through the levels 'high', 'low' (if enabled), and 'empty'. Any changes will propagate via the server to all connected clients.
- **Non-logged-in users** - Clicking a on a number will 'check it off' by adding a cross to it. These are only stored in the browser and not shared.

The rest of the functionality can be used by anyone:

- Clicking on the header will pop up a menu for managing the check marks and display options
- When the menu is open, clicking anywhere other than the menu will close it. You can also press 'Escape'
- Pressing `Tab` or `Shift + Tab` will cycle through the buttons
- Pressing `Enter` will 'click' the focused or last pressed button
- Pressing `Escape` will un-highlight a focused button
- Pressing `Ctrl + Z` will undo the the most recent check mark
- Pressing `Ctrl + Y` will redo the previously undone check mark

## Slideshow

<img src="/docs/images/slideshow.png" width="384">

This slideshow contains sponsor slides and event information as well as an embedded 'Availability' page.

## History

<img src="/docs/images/history.png" width="384">

This page displays recent updates to beer availability.
