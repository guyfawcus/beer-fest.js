const socket = io.connect(self.location.host);
const aos_colour = "#e84118";
const stock_colour = "#00a8ff";
let stock_levels = {};

// Make sure the user wants to update the selected number
function confirmUpdate(button_number) {
  const r = confirm(`Are you sure you want to update number ${button_number}`);
  if (r != true) {
    return;
  }
  updateFromLocal(button_number);
}

// Change the colour of the button depending on the stock level
function updateLevel(button_number, stock_level) {
  const button_id = document.getElementById(`button_${button_number}`);
  if (stock_level == "aos") {
    button_id.className = "aos";
    button_id.style.background = aos_colour;
  } else if (stock_level == "stock") {
    button_id.className = "stock";
    button_id.style.background = stock_colour;
  }
}

// Update the table based on local changes to the stock state
function updateFromLocal(button_number) {
  const button_id = document.getElementById(`button_${button_number}`);

  if (button_id.className != "aos") {
    stock_levels[button_number] = "aos";
    socket.emit("update single", [button_number, "aos"]);
    updateLevel(button_number, "aos");
  } else {
    stock_levels[button_number] = "stock";
    socket.emit("update single", [button_number, "stock"]);
    updateLevel(button_number, "stock");
  }
}

// Update the table based on remote changes to the stock state
function updateFromState(stock_levels) {
  for (button_number in stock_levels) {
    if (stock_levels[button_number] == "aos") {
      updateLevel(button_number, "aos");
    } else if (stock_levels[button_number] == "stock") {
      updateLevel(button_number, "stock");
    }
  }
}

// Update the state when remotes send updates
socket.on("update table", table => {
  stock_levels = JSON.parse(table);
  updateFromState(stock_levels);
  console.log(`Updating table from ${table}`);
});

socket.on("update single", stock_level => {
  stock_levels[stock_level[0]] = stock_level[1];
  updateLevel(stock_level[0], stock_level[1]);
  console.log(`Number ${stock_level[0]} = ${stock_level[1]}`);
});

socket.on("connect", () => {
  console.log("Server connected");
  document.getElementById("title").style.color = "#f5f6fa";
});

socket.on("disconnect", () => {
  console.log("Server diconnected!");
  document.getElementById("title").style.color = "#e84118";
});
