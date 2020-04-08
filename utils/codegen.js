#!/usr/bin/env node

const bcrypt = require("bcryptjs");
const readline = require("readline");
const { exec } = require("child_process");

let hashedCode = "";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter new code: ", (code) => {
  hashedCode = bcrypt.hashSync(code, 6);
  console.log(hashedCode);
  exec(`heroku config:set ADMIN_CODE='${hashedCode}'`);
  rl.close();
});
