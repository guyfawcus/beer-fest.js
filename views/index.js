const socket = io.connect(self.location.host);
let AUTHORISED = false;

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

socket.on("auth", (status) => {
  if (status) {
    AUTHORISED = true;
    document.getElementById("login").innerHTML = "Log out";
    document.getElementById("login").onclick = () => (location.href = "/logout");
    console.log("Authenticated with server");
  } else {
    AUTHORISED = false;
    document.getElementById("login").innerHTML = "Log in";
    document.getElementById("login").onclick = () => (location.href = "/login");
    console.log("Not authenticated");
  }
});
