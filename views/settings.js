const socket = io.connect(self.location.host);
let stock_levels = {};

function tableFill() {
  const r = confirm(
    "Are you sure you want to mark everything as out of stock?"
  );
  if (r != true) {
    return;
  }
  console.log("Filling table");
  const table = {};
  for (i = 1; i <= 80; i++) {
    table[i] = "aos";
  }
  socket.emit("update table", JSON.stringify(table));
}

function tableClear() {
  const r = confirm("Are you sure you want to mark everything as in-stock?");
  if (r != true) {
    return;
  }
  console.log("Clearing table");
  const table = {};
  for (i = 1; i <= 80; i++) {
    table[i] = "stock";
  }
  socket.emit("update table", JSON.stringify(table));
}

function tableUpload() {

}

function tableDownload() {
  let file = new Blob([JSON.stringify(stock_levels)], {
    type: "application/json;charset=utf-8"
  });
  let download_url = URL.createObjectURL(file);
  let download_element = document.createElement("a");
  download_element.style.display = "none";
  download_element.setAttribute("href", download_url);
  download_element.setAttribute("download", "state.json");
  document.body.appendChild(download_element);
  download_element.click();
  document.body.removeChild(download_element);
}

// Update the state when remotes send updates
socket.on("update table", table => {
  stock_levels = JSON.parse(table);
  console.log(`Updating table from ${table}`);
});

socket.on("connect", () => {
  console.log("Server connected");
  document.getElementById("title").style.color = "#2f3640";
});

socket.on("disconnect", () => {
  console.log("Server diconnected!");
  document.getElementById("title").style.color = "#e84118";
});
