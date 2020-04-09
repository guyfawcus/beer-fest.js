const socket = io.connect(self.location.host);

const getCode = () => {
  let code = prompt("Enter code:");
  socket.emit("auth", code);
};

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
