beer-fest.js
============
Web app to display available beers at a festival

<img src="/docs/images/availability-empty.png" width="384">

Use case
--------
This project was designed for use at [The Aston Clinton Beer Festival](http://www.astonclintonbeerfestival.co.uk/).
Above the bar, there are usually four screens that display a slideshow with sponsor slides
and the availability of the 80 ales on offer so that people don't queue for something that has run out. 

### The old way
The slideshow video is fed from a pair of laptops in another building that needs to have cables run from it to the bar screens.
When a beer runs out, someone edits the slideshow on the laptop that is currently not live,
switches the video feed so that it comes from the updated laptop,
then edits the slideshow on the other laptop so that it's ready for the next update.

Needless to say, this takes a while so isn't done as regularly as could be and is complicated enough that only the bar manager usually does it.
Not ideal for the punters or the one who has to do all of the updating!

### The new way
After a logging in, it's as simple as:
* Open the [availability page](https://acbf-2020.herokuapp.com/availability) on your phone / laptop
* Mark the selected beer as empty

The updated level will then be sent to the four screens!

### The additional benefits
Because the this is a web app, it can be run on a server [like this one](https://acbf-2020.herokuapp.com/) and anyone can connect to it,
to check the availability of a beer or to update it!
(Don't worry, you can't change anything without logging in first)

It could also be run locally on minimimal hardware (laptop, Raspberry Pi, whatever you fancy) so if you wanted, you could keep using 'the old way' while testing out this system without much bother.

Installation
------------
1. Install [Node.js](https://nodejs.org/)
2. Install and run [Redis](https://redis.io/download)
3. `git clone https://github.com/guyfawcus/beer-fest.git`
4. `cd beer-fest`
5. `npm install`
5. `node server.js`
6. Open [127.0.0.1:8000](http://127.0.0.1:8000/) in an up-to-date browser
