const axios = require("axios");
const fs = require("fs");
const twilio = require("twilio");
const moment = require("moment");

async function handler() {
  var client;
  var projectIDS = [];
  var overdueProjects = [];
  async function getEnvironment() {
    if (!process.env.AWS_LAMBDA_FUNCTION_VERSION) {
      let result = (resolve, reject) => {
        fs.readFile("../config.json", "utf8", (err, data) => {
          if (err) {
            console.log(err);
            reject(err);
          }
          resolve(JSON.parse(data));
          process.env = JSON.parse(data);
        });
      };
      return new Promise(result);
    }
  }

  async function initialiseTwilio() {
    let result = (resolve, reject) => {
      try {
        client = new twilio(process.env.accountSid, process.env.authToken);
        resolve(client);
      } catch (error) {
        console.log(error);
        reject(error);
      }
    };
    return new Promise(result);
  }

  async function sendSMS(e) {
    let result = (resolve, reject) => {
      try {
        client.messages
          .create({
            body: `${e.content} is overdue`,
            to: process.env.MyNumber, // Text this number
            from: process.env.twilioPhone, // From a valid Twilio number
          })
          .then((message) => {
            console.log(message.sid);
            console.log("sent");
            resolve(message.sid);
          });
      } catch (error) {
        console.log(error);
        reject(error);
      }
    };
    return new Promise(result);
  }

  async function getAllProjects() {
    let result = (resolve, reject) => {
      try {
        axios({
          method: "get",
          url: "https://api.todoist.com/rest/v1/projects",
          headers: {
            Authorization: `Bearer ${process.env.token}`,
          },
        }).then((response) => {
          response.data.map((item) => {
            projectIDS.push(item.id);
          });
          resolve(projectIDS);
        });
      } catch (error) {
        console.log(error);
        reject(error);
      }
    };
    return new Promise(result);
  }

  async function getAllActiveTasks() {
    const url = "https://api.todoist.com/rest/v1/tasks";

    try {
      await axios.all(
        projectIDS.map(async (i) => {
          await axios({
            url: url,
            params: { project_id: i },
            headers: {
              Authorization: `Bearer ${process.env.token}`,
            },
          }).then((response) => {
            overdueProjects.push(response.data);
          });
        })
      );
    } catch (error) {
      console.log(error);
    }
    return overdueProjects;
  }

  await getEnvironment();
  await initialiseTwilio();
  let a = await getAllProjects();
  getAllActiveTasks();

  //   overdue.map((e) => {
  //     sendSMS(e);
  //   });
  // }
}

handler();
