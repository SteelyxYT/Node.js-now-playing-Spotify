const say = require("say");
const fs = require("node:fs");
const colors = require("colors");
const axios = require("axios");
const express = require("express");
const app = express();
require("dotenv").config();
const port = 3000;

let code;
let currentSong = "";
let tokenType;
let accessToken;
let refreshToken;
let name;
let membership;
let songLogged = false;
let errorQueue = []; // Queue for error messages
let isSpeakingError = false; // Flag to track if an error message is currently being spoken

const logFilePath = "songs.json";

function readLog() {
  if (fs.existsSync(logFilePath)) {
    const data = fs.readFileSync(logFilePath);
    return JSON.parse(data);
  }
  return {};
}

function writeLog(log) {
  const logEntries = Object.entries(log);
  logEntries.sort((a, b) => b[1].count - a[1].count);
  const sortedLog = Object.fromEntries(logEntries);
  fs.writeFileSync(logFilePath, JSON.stringify(sortedLog, null, 2));
}

async function startMain() {
  const tokenGetheaders = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization:
      "Basic " +
      new Buffer.from(
        process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET
      ).toString("base64"),
  };
  try {
    let getToken = await axios.post(
      "https://accounts.spotify.com/api/token",
      {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: "http://localhost:3000",
      },
      {
        headers: tokenGetheaders,
      }
    );
    console.timeStamp();
    console.log(getToken.data);

    tokenType = getToken.data.token_type;
    accessToken = getToken.data.access_token;
    refreshToken = getToken.data.refresh_token;

    await axios
      .get("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `${tokenType} ` + accessToken,
        },
      })
      .then((res) => {
        name = res.data.display_name;
        membership = res.data.product;
        console.log(
          `Welcome ${name} your membership status is ${membership} and you are now logged in`
            .green
        );
        queueMessage(
          "Welcome " +
            name +
            " your membership status is " +
            membership +
            " and you are now logged in"
        );
      })
      .catch((err) => {
        console.log(err);
        console.log(
          "Error: ".red +
            "Couldent fetch user information, trying refreshing token"
        );
        queueMessage(
          "Error: Couldent fetch user information, trying refreshing token"
        );
        axios
          .post(
            "https://accounts.spotify.com/api/token",
            {
              grant_type: "refresh_token",
              refresh_token: refreshToken,
            },
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                authorization:
                  "Basic " +
                  new Buffer.from(
                    process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET
                  ).toString("base64"),
              },
            }
          )
          .then((res) => {
            console.log(res.data);
            accessToken = res.data.access_token;
            if (res.data.refresh_token) {
              refreshToken = res.data.refresh_token;
            }
            tokenType = res.data.token_type;
            console.log(
              "The access token has been refreshed and you are now logged in"
                .green
            );
            queueMessage(
              "The access token has been refreshed and you are now logged in"
            );
          })
          .catch((err) => {
            console.log(err);
            console.log(
              "Error: ".red + "Could not refresh token, shutting down"
            );
            queueMessage("Error: Could not refresh token, shutting down");
            setTimeout(() => {
              process.exit();
            }, 10000);
          });
      });

    setInterval(async () => {
      await axios
        .get("https://api.spotify.com/v1/me/player/currently-playing", {
          headers: {
            Authorization: `${tokenType} ` + accessToken,
          },
        })
        .then((getTrack) => {
          if (getTrack.data != "") {
            if (getTrack.data.is_playing) {
              if (getTrack.data.progress_ms >= 60000 && !songLogged) {
                songLogged = true;
                const log = readLog();
                if (log[getTrack.data.item.name]) {
                  log[getTrack.data.item.name].count += 1;
                } else {
                  log[getTrack.data.item.name] = {
                    id: getTrack.data.item.id,
                    artist: getTrack.data.item.artists[0].name,
                    count: 1,
                  };
                }
                writeLog(log);
              }
            }

            if (
              getTrack.data.item.name != currentSong &&
              getTrack.data.item.name != ""
            ) {
              songLogged = false;
              if (getTrack.data.is_playing) {
                currentSong = getTrack.data.item.name;

                console.log(
                  "Now playing: " +
                    currentSong +
                    " by " +
                    getTrack.data.item.artists[0].name
                );
                queueMessage(
                  "Now playing: " +
                    currentSong +
                    " by " +
                    getTrack.data.item.artists[0].name
                );
              }
            }
          } else {
            currentSong = "";
          }
        })
        .catch((err) => {
          console.log(err);
          console.log(
            "Error: ".red +
              "Couldent fetch current track, trying refreshing token"
          );
          queueMessage(
            "Error: Couldent fetch current track, trying refreshing token"
          );
          axios
            .post(
              "https://accounts.spotify.com/api/token",
              {
                grant_type: "refresh_token",
                refresh_token: refreshToken,
              },
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  authorization:
                    "Basic " +
                    new Buffer.from(
                      process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET
                    ).toString("base64"),
                },
              }
            )
            .then((res) => {
              console.log(res.data);
              accessToken = res.data.access_token;
              if (res.data.refresh_token) {
                refreshToken = res.data.refresh_token;
              }
              tokenType = res.data.token_type;
              console.log(
                "The access token has been refreshed and you are now logged in"
                  .green
              );
              queueMessage(
                "The access token has been refreshed and you are now logged in"
              );
            })
            .catch((err) => {
              console.log(err);
              console.log(
                "Error: ".red + "Could not refresh token, shutting down"
              );
              queueMessage("Error: Could not refresh token, shutting down");
              clearInterval();
              setTimeout(() => {
                process.exit();
              }, 10000);
            });
        });
    }, 2000);
  } catch (err) {
    console.log(err);
    console.log("Error: ".red + "The code given does no longer work");
    queueMessage("Error: The code given does no longer work");
  }
}

function queueMessage(errorText) {
  errorQueue.push(errorText); // Add error message to the queue
  if (!isSpeakingError) {
    speakNextError(); // If no error is currently being spoken, start speaking
  }
}

function speakNextError() {
  if (errorQueue.length > 0) {
    const nextError = errorQueue.shift(); // Dequeue the next error message
    isSpeakingError = true;
    say.speak(nextError, undefined, undefined, (err) => {
      if (err) {
        console.error("Error speaking:", err);
      }
      isSpeakingError = false;
      speakNextError(); // Continue to speak next error in the queue
    });
  }
}

app.get("/", (req, res) => {
  code = req.query.code;
  console.log("code: " + code);
  startMain();
  res.send("Your request has been forwarded to the node application.");
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
  console.log("To login please visit the link under");
  console.log(
    "Login: ".green +
      `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=http://localhost:3000&scope=user-read-private%20user-read-email%20user-read-currently-playing`
  );
  console.log("Press Ctrl+C to exit");
});
