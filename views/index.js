/* eslint-env browser */
/* global io */
"use strict";

const socket = io.connect(self.location.host);

socket.on("connect", () => {
  console.log("Server connected");
  document.getElementsByClassName("warning_icon")[0].style.display = "none";
});

socket.on("disconnect", () => {
  window.setTimeout(function() {
    if (socket.connected !== true) {
      console.log("%cServer diconnected!", "color:red;");
      document.getElementsByClassName("warning_icon")[0].style.display = "grid";
    }
  }, 2000);
});

socket.on("auth", status => {
  if (status) {
    document.getElementById("login").innerHTML = "Log out";
    document.getElementById("login").href = "/logout";
    console.log("Authenticated with server");
  } else {
    document.getElementById("login").innerHTML = "Log in";
    document.getElementById("login").href = "/login";
    console.log("Not authenticated");
  }
});
