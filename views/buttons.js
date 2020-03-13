const socket = io.connect(self.location.host);
const aos_colour = "#d81010";
const stock_colour = "#1999bb";
let stock_levels = {};

function updateStock(button_number) {
  const button = document.getElementById(`button_${button_number}`);

  if (button.className != "aos") {
    stock_levels[button.id] = "aos";
    button.style.background = aos_colour;
    console.log(`${button_number} is out of stock`);
    socket.emit("update table", JSON.stringify(stock_levels));
    button.className = "aos";
  } else {
    stock_levels[button.id] = "stock";
    button.style.background = stock_colour;
    console.log(`${button_number} is back in stock`);
    socket.emit("update table", JSON.stringify(stock_levels));
    button.className = "stock";
  }
}

function confirmUpdate(button_number){
  const r = confirm(`Are you sure you want to update number ${button_number}`);
  if (r != true) {
    return;
  }
  updateStock(button_number);
}

function updateAllStock(stock_levels) {
  for (button in stock_levels) {
    if (stock_levels[button] == "aos") {
      document.getElementById(`${button}`).className = "aos";
      document.getElementById(`${button}`).style.background = aos_colour;
    } else if (stock_levels[button] == "stock") {
      document.getElementById(`${button}`).className = "stock";
      document.getElementById(`${button}`).style.background = stock_colour;
    }
  }
}

socket.on("update table", table => {
  stock_levels = JSON.parse(table);
  updateAllStock(stock_levels);
  console.log(`Updating table from ${table}`);
});

