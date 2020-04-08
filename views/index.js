const socket = io.connect(self.location.host);

const getCode = () => {
  let code = prompt("Enter code:");
  socket.emit("auth", code);
};

socket.on("connect", () => {
  console.log("Server connected");
  document.getElementById("title").style.color = "#f5f6fa";
});

socket.on("disconnect", () => {
  console.log("%cServer diconnected!", "color:red;");
  document.getElementById("title").style.color = "#e84118";
});
