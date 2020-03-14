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
function updateLevel(stock_level, button_number) {
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
  const button = document.getElementById(`button_${button_number}`);

  if (button.className != "aos") {
    stock_levels[button_number] = "aos";
    console.log(`${button_number} is out of stock`);
    socket.emit("update table", JSON.stringify(stock_levels));
    updateLevel('aos', button_number);
  } else {
    stock_levels[button_number] = "stock";
    console.log(`${button_number} is back in stock`);
    socket.emit("update table", JSON.stringify(stock_levels));
    updateLevel('stock', button_number);
  }
}

// Update the table based on remote changes to the stock state
function updateFromState(stock_levels) {
  for (button_number in stock_levels) {
    if (stock_levels[button_number] == "aos") {
      updateLevel('aos', button_number);
    } else if (stock_levels[button_number] == "stock") {
      updateLevel('stock', button_number);
    }
  }
}

// Update the state when remotes send updates
socket.on("update table", table => {
  stock_levels = JSON.parse(table);
  updateFromState(stock_levels);
  console.log(`Updating table from ${table}`);
});
