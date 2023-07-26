# beer-fest.js

[![Discord chat](https://img.shields.io/discord/728418000952360980)](https://discord.gg/waafeHb)

Web app to display available beers at a festival

Try it out at [acbf.app](https://acbf.app/) and take a look at the [walkthrough tutorial](/docs/walkthrough.md) to get started.

<img src="/docs/images/availability-empty.png" width="384">

> **Note:** This web app is under development. Its first outing was likely to be the _Aston Clinton Beer Festival 2020_ (hence the titles/URL), however that has now [been cancelled](https://www.facebook.com/341405185896402/posts/2925670634136498).
> Fingers crossed for some normality to return next year and that everyone makes it though these crazy times!
>
> The beer information (used for the tooltips, Ve/GF hiding) is from the 2019 beer fest and is being used as a placeholder to assist development.

---

## Use case

This project was designed for use at [The Aston Clinton Beer Festival](http://www.astonclintonbeerfestival.co.uk/).
Above the bar, there are usually four screens that display a slideshow with sponsor slides
and the availability of the 80+ ales on offer so that people don't queue for something that has run out.

### The old way

The slideshow video is fed from a pair of laptops in another building that needs to have cables run from it to the bar screens.
When a beer runs out, someone edits the slideshow on the laptop that is currently not live,
switches the video feed so that it comes from the updated laptop,
then edits the slideshow on the other laptop so that it's ready for the next update.

Needless to say, this takes a while so isn't done as regularly as could be and is complicated enough that only the bar manager usually does it.
Not ideal for the punters or the one who has to do all of the updating!

### The new way

After logging in, it's as simple as:

- Open the [availability page](https://acbf.app/availability) on your phone / laptop
- Mark the selected beer as empty

The updated level will then be sent to the four screens!

### The additional benefits

Because the this is a web app, it can be run on a server [like this one](https://acbf.app/) and anyone can connect to it,
to check the availability of a beer or to update it!
(Don't worry, you can't change anything without logging in first)

It could also be run locally on minimal hardware (laptop, Raspberry Pi, whatever you fancy) so if you wanted,
you could keep using _the old way_ while testing out this system without much bother.

---

## Tech information

There are a few different ways to implement this system and each has its positives and negatives:

### The most basic way

One machine to run the server and the browser - open two browser windows and connect an external monitor.
Navigate to the _Slideshow_ page in one window and maximise it on the external screen.
On the local screen, navigate to the _Availability_ page and maximise the browser window.

This method has the advantage of being simple and quick to set up,
but it does require running video cable from the computer to all of the displays.

You could put this computer on a network and then connect to it over Wi-Fi from any number of devices,
but this would mean that anyone connected would likely not be able to use mobile data,
also it's a single point of failure. If you want external clients, you're probably better off with the next method...

### The local way

One machine to run the server - this computer just runs the web app and is only connected to a local network, you could have an access point on the network to wirelessly connect other clients.

This main disadvantage to this is the same as the last method, any clients who connect will likely not be able to access their mobile data.
If that's not an issue though, and all of the clients are just _show machines_ then this is the best option if connecting to the internet is not easy...

### The internet way

No server setup required - If the venue has internet access or decent mobile service, and you can easily get the main display machine online,
then this is by far the best option.

- You won't need to configure every single client with the IP address of the server
- You won't need to run any video cabling (if each screen can connect to the website, either by itself or via a Pi)
- You don't have to worry about a single point of failure because the app can be run over multiple servers
- It can be configured remotely so tech support is much easier
- Anyone can connect to it with only the website address (which could be linked from the festivals website)

### The others ways

There are of course a load of different variations of the above and it really depends on what you want from this system as to the best way to implement it.
The easiest option will pretty much always be using _The internet way_ and getting myself (@guyfawcus / Chesney) to configure it.
This software is all open source though so if you're brave enough to go it alone, take a look at the [development instructions](/docs/development.md).
