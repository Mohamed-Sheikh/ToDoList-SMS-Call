const axios = require("axios");
const fs = require("fs");
const twilio = require("twilio");
const moment = require("moment");

exports.handler = async (event) => {
  var client;
  var projectIDS = [];
  var overdueProjects = [];
  var currentlyDue = [];
  async function getEnvironment() {
    if (!process.env.AWS_LAMBDA_FUNCTION_VERSION) {
      let result = (resolve, reject) => {
        fs.readFile("../config.json", "utf8", (err, data) => {
          if (err) {
            console.log(err);
            reject(err);
          }
          resolve(JSON.parse(data));
          console.log("retrieved environment variables");
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
        console.log("Initialised Twilio");
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
            body: `${e.content} is overdue. Should have been done by ${e.due.date}`,
            to: process.env.MyNumber, // Text this number
            from: process.env.twilioPhone, // From a valid Twilio number
          })
          .then((message) => {
            console.log(message.sid);
            console.log("sent message");
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
          console.log("retrieved all projects");
          resolve(projectIDS);
        });
      } catch (error) {
        console.log(error);
        reject(error);
      }
    };
    return new Promise(result);
  }

  async function getAllTasks() {
    const url = "https://api.todoist.com/rest/v1/tasks";

    return new Promise(async (resolve, reject) => {
      try {
        await axios.all(
          projectIDS.map(async (i) => {
            await axios({
              url: url,
              params: { project_id: i },
              headers: {
                Authorization: `Bearer ${process.env.token}`,
              },
            }).then(async (response) => {
              response.data.map(async (i) => {
                if (
                  i.due &&
                  moment().subtract(1, "day").isAfter(moment(i.due.date))
                ) {
                  await overdueProjects.push(i);
                } else if (i.due && moment().isSame(moment(i.due.date))) {
                  await currentlyDue.push(i);
                }
              });
            });
          })
        );
        console.log("retrieved all overdue projects");
        resolve(overdueProjects);
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }
  // });

  async function determineNextStep() {
    var tasksToDo = "";
    try {
      overdueProjects.map(async (element, index) => {
        if (element.due) {
          if (moment().diff(moment(element.due.date), "day") > 2) {
            tasksToDo +=
              " Task " + (index + 1).toString() + " " + element.content;
          } else {
            await sendSMS(element);
          }
        }
      });
      console.log(tasksToDo);
      if (tasksToDo.length > 1) {
        console.log("Making a call");
        await makeCall(tasksToDo);
        console.log("successfully called");
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function makeCall(tasks) {
    try {
      client.calls
        .create({
          twiml: `<Response><Say>${tasks}</Say></Response>`,
          to: process.env.MyNumber,
          from: process.env.twilioPhone,
        })
        .then((call) => console.log(call.sid));
    } catch (error) {
      console.log(error);
    }
  }
  async function sendTodaysTaks() {
    console.log(1);
    let status;
    try {
      console.log(2);
      for (let i = 0; i < currentlyDue.length; i++) {
        console.log("SENDING SMS");
        console.log(3);
        await sendSMS(currentlyDue[i]);
        console.log(4);
      }
      status = "done";
    } catch (error) {
      console.log(6);
      console.log(error);
      status = "error";
      console.log(7);
    }
    console.log(8);
    return status;
  }

  await getEnvironment();
  await initialiseTwilio();
  await getAllProjects();
  let overdue = await getAllTasks();
  console.log("BEFORE");
  if ((await overdue.length) > 0) {
    console.log("IN OVERDUE");
    await determineNextStep();
  } else {
    console.log("IN ELSE");
    await sendTodaysTaks();
    console.log("JUMPER OVE IT");
  }
  console.log("AFTER");
};

// handler();
