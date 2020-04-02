const socket = io.connect(self.location.host);
let stock_levels = {};

function tableFill() {
  const r = confirm("Are you sure you want to mark everything as out of stock?");
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
  const input_element = document.createElement("input");
  input_element.type = "file";
  input_element.onchange = function() {
    const reader = new FileReader();
    const file = input_element.files[0];
    reader.onload = function() {
      // File type validation
      if (file.type != "application/json") {
        alert("Error: this file is not of the right type,\nplease upload a 'state.json' file");
        return;
      }

      // File size validation
      if (file.size > 1032) {
        alert("Error: this file is too large,\nplease upload a valid 'state.json' file");
        return;
      }

      // Data validation
      try {
        let data = JSON.parse(reader.result);
      } catch (error) {
        alert("Error: could not parse JSON,\nplease upload a valid 'state.json' file");
        return;
      }

      const r = confirm("Are you sure you want to use this data?");
      if (r == true) {
        updateRequired(JSON.parse(reader.result));
      }
    };

    reader.readAsText(file);
    console.log(`Reading in ${file.size} bytes from ${file.name}`);
  };
  input_element.click();
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
  URL.revokeObjectURL(file);
}

function updateRequired(table) {
  for (let [button_number, stock_level] of Object.entries(table)) {
    if (stock_level != stock_levels[button_number]) {
      console.log(`Setting ${button_number} as ${stock_level}`);
      socket.emit("update single", [button_number, stock_level]);
    }
  }
}

// Update the state when remotes send updates
socket.on("update table", table => {
  console.log("%cUpdating table from:", "font-weight:bold;");
  console.log(JSON.parse(table));
  stock_levels = JSON.parse(table);
});

socket.on("update single", stock_level => {
  console.log(`Setting ${stock_level[0]} as ${stock_level[1]}`);
  stock_levels[stock_level[0]] = stock_level[1];
});

socket.on("connect", () => {
  console.log("Server connected");
  document.getElementById("title").style.color = "#f5f6fa";
});

socket.on("disconnect", () => {
  console.log("%cServer diconnected!", "color:red;");
  document.getElementById("title").style.color = "#e84118";
});
