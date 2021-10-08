// 'use strict';

var Client = require('azure-iothub').Client;
var Message = require('azure-iot-common').Message;

const { Guid } = require('js-guid');

function printResultFor(httpRes) {
  return (err, res) => {
    if (err) {
      var errorMessage = "Failed with error during sending message - " + err.toString;
      console.err(errorMessage);
      httpRes.status(500)
          .send({"errorMessage" : errorMessage });
    } else if (res) {
      console.log('Status for sending message: ' + res.constructor.name);
      httpRes.status(200)
          .send({status: "Successful"});
    } else{
      console.error("Neither err nor response are defined for sending message.")
      httpRes.status(500)
        .send({errorMessage : "Neither err nor response are defined."});
    }
  };
}

function receiveFeedback(httpRes) {
  return (err, receiver) => {
    if (err) {
      var errorMessage = "Failed during receive feedback with error - " + err.toString
      console.error('Error in receive feedback: ' + err.toString());
      httpRes.status(500)
          .send({errorMessage : errorMessage });
    } else {
      receiver.on('message', function (msg) {
        console.log('Feedback message: ' + msg.getData().toString('utf-8'))
      });
    }
  };
}

async function publishCommandToWaterThePlant(iotHubConnectionString, targetDevice) {
  var serviceClient = Client.fromConnectionString(iotHubConnectionString);
  serviceClient.open(function (err) {
    if (err) {
      console.error('Could not connect: ' + err.message);
    } else {
      console.log('Service client connected');
      serviceClient.getFeedbackReceiver(receiveFeedback(res));
      var message = new Message('Water the plant');
      message.ack = 'full';
      console.log('Sending message: ' + message.getData());
      serviceClient.send(targetDevice, message, printResultFor('send', res));
      console.log("Sent")
    }
  });
}

module.exports = {
  publishCommandToWaterThePlant
};