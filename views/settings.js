const socket = io.connect(self.location.host);

function tableClear() {
  const r = confirm("Are you sure you want to clear the whole table");
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

}
