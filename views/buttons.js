const socket = io.connect(self.location.host);
const empty_colour = "#e84118";
const full_colour = "#00a8ff";
let stock_levels = {};

let TO_CONFIRM = true;

// Make sure the user wants to update the selected number
function confirmUpdate(button_number, to_confirm = TO_CONFIRM) {
  const button_id = document.getElementById(`button_${button_number}`);

  if (button_id.className != "empty") {
    if (to_confirm) {
      if (confirm(`Are you sure you want to mark number ${button_number} as empty`) != true) return;
    }
    socket.emit("update single", { number: button_number, level: "empty" });
    updateLevel(button_number, "empty");
  } else {
    if (to_confirm) {
      if (confirm(`Are you sure you want to mark number ${button_number} as full`) != true) return;
    }
    socket.emit("update single", { number: button_number, level: "full" });
    updateLevel(button_number, "full");
  }
}

// Change the colour of the button depending on the stock level
function updateLevel(button_number, stock_level) {
  const button_id = document.getElementById(`button_${button_number}`);
  if (stock_level == "empty") {
    console.log(`Setting ${button_number} as empty`);
    stock_levels[button_number] = "empty";
    button_id.className = "empty";
    button_id.style.background = empty_colour;
  } else if (stock_level == "full") {
    console.log(`Setting ${button_number} as full`);
    stock_levels[button_number] = "full";
    button_id.className = "full";
    button_id.style.background = full_colour;
  }
}

// Update the table based on remote changes to the stock levels
function updateFromState(stock_levels) {
  console.log("%cUpdating table from:", "font-weight:bold;");
  console.log(stock_levels);
  for (button_number in stock_levels) {
    if (stock_levels[button_number] == "empty") {
      updateLevel(button_number, "empty");
    } else if (stock_levels[button_number] == "full") {
      updateLevel(button_number, "full");
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
  updateLevel(stock_level["number"], stock_level["level"]);
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
