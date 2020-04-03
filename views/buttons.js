const socket = io.connect(self.location.host);
const aos_colour = "#e84118";
const stock_colour = "#00a8ff";
let stock_levels = {};

let TO_CONFIRM = true;

// Make sure the user wants to update the selected number
function confirmUpdate(button_number, to_confirm = TO_CONFIRM) {
  const button_id = document.getElementById(`button_${button_number}`);

  if (button_id.className != "aos") {
    if (to_confirm) {
      if (confirm(`Are you sure you want to mark number ${button_number} as out-of-stock`) != true) return;
    }
    socket.emit("update single", [button_number, "aos"]);
    updateLevel(button_number, "aos");
  } else {
    if (to_confirm) {
      if (confirm(`Are you sure you want to mark number ${button_number} as in-stock`) != true) return;
    }
    socket.emit("update single", [button_number, "stock"]);
    updateLevel(button_number, "stock");
  }
}

// Change the colour of the button depending on the stock level
function updateLevel(button_number, stock_level) {
  const button_id = document.getElementById(`button_${button_number}`);
  if (stock_level == "aos") {
    console.log(`Setting ${button_number} as out-of-stock`);
    stock_levels[button_number] = "aos";
    button_id.className = "aos";
    button_id.style.background = aos_colour;
  } else if (stock_level == "stock") {
    console.log(`Setting ${button_number} as in-stock`);
    stock_levels[button_number] = "stock";
    button_id.className = "stock";
    button_id.style.background = stock_colour;
  }
}

// Update the table based on remote changes to the stock state
function updateFromState(stock_levels) {
  console.log("%cUpdating table from:", "font-weight:bold;");
  console.log(stock_levels);
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
  console.groupCollapsed("Updating all entities");
  updateFromState(JSON.parse(table));
  console.groupEnd();
});

socket.on("update single", stock_level => {
  updateLevel(stock_level[0], stock_level[1]);
});

socket.on("config", configuration => {
  console.log("%cUpdating configuration from:", "font-weight:bold;");
  console.log(configuration);
  if (configuration["confirm"]) {
    TO_CONFIRM = true;
  } else {
    TO_CONFIRM = false;
  }
});

socket.on("connect", () => {
  console.log("Server connected");
  document.getElementById("title").style.color = "#f5f6fa";
});

socket.on("disconnect", () => {
  console.log("%cServer diconnected!", "color:red;");
  document.getElementById("title").style.color = "#e84118";
});
