const socket = io.connect(self.location.host);
const empty_colour = getComputedStyle(document.body).getPropertyValue("--empty-colour");
const low_colour = getComputedStyle(document.body).getPropertyValue("--low-colour");
const full_colour = getComputedStyle(document.body).getPropertyValue("--full-colour");
let stock_levels = {};

let TO_CONFIRM = true;
let LOW_ENABLE = false;
let AUTHORISED = false;

const confirmUpdate = button_number => {
  if (AUTHORISED) {
    goUpdate(button_number);
  } else {
    console.log("Not authorised");
  }
};

// Make sure the user wants to update the selected number
function goUpdate(button_number, to_confirm = TO_CONFIRM) {
  const button_id = document.getElementById(`button_${button_number}`);
  if (LOW_ENABLE == true) {
    if (stock_levels[button_number] == "full") {
      if (to_confirm) {
        if (confirm(`Are you sure you want to mark number ${button_number} as low`) != true) return;
      }
      socket.emit("update single", { number: button_number, level: "low" });
    } else if (stock_levels[button_number] == "low") {
      if (to_confirm) {
        if (confirm(`Are you sure you want to mark number ${button_number} as empty`) != true) return;
      }
      socket.emit("update single", { number: button_number, level: "empty" });
    } else if (stock_levels[button_number] == "empty") {
      if (to_confirm) {
        if (confirm(`Are you sure you want to mark number ${button_number} as full`) != true) return;
      }
      socket.emit("update single", { number: button_number, level: "full" });
    }
  } else {
    if (stock_levels[button_number] == "full") {
      if (to_confirm) {
        if (confirm(`Are you sure you want to mark number ${button_number} as empty`) != true) return;
      }
      socket.emit("update single", { number: button_number, level: "empty" });
    } else if (stock_levels[button_number] == "low") {
      if (to_confirm) {
        if (confirm(`Are you sure you want to mark number ${button_number} as empty`) != true) return;
      }
      socket.emit("update single", { number: button_number, level: "empty" });
    } else if (stock_levels[button_number] == "empty") {
      if (to_confirm) {
        if (confirm(`Are you sure you want to mark number ${button_number} as full`) != true) return;
      }
      socket.emit("update single", { number: button_number, level: "full" });
    }
  }
}

// Change the colour of the button depending on the stock level
function updateLevel(button_number, stock_level) {
  const button_id = document.getElementById(`button_${button_number}`);
  if (stock_level == "empty") {
    console.log(`Setting ${button_number} as empty`);
    stock_levels[button_number] = "empty";
    button_id.style.background = empty_colour;
  } else if (stock_level == "low") {
    console.log(`Setting ${button_number} as low`);
    stock_levels[button_number] = "low";
    button_id.style.background = low_colour;
  } else if (stock_level == "full") {
    console.log(`Setting ${button_number} as full`);
    stock_levels[button_number] = "full";
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
    } else if (stock_levels[button_number] == "low") {
      updateLevel(button_number, "low");
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
  if (configuration["low_enable"]) {
    LOW_ENABLE = true;
  } else {
    LOW_ENABLE = false;
  }
});

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

socket.on("auth", status => {
  if (status) {
    AUTHORISED = true;
    console.log("Authenticated with server");
  } else {
    AUTHORISED = false;
    console.log("Not authenticated");
  }
});
