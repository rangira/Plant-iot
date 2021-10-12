const { Guid } = require('js-guid');
var Client = require('azure-iothub').Client;
var Message = require('azure-iot-common').Message;

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const EventHubReader = require('./scripts/event-hub-reader.js');
const CommandPublisher = require('./scripts/command-publisher.js');
const { publishCommandToWaterThePlant } = require('./scripts/command-publisher.js');

// const iotHubConnectionString = process.env.IotHubConnectionString
const iotHubConnectionString = "HostName=hackathon-pi-plant-iot.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=zwhyXGztiMhst5RNdexLWCA6+aNlqTafknw1Z0oiWP8=";
if (!iotHubConnectionString) {
  console.error(`Environment variable IotHubConnectionString must be specified.`);
  return;
}
console.log(`Using IoT Hub connection string [${iotHubConnectionString}]`);

// const eventHubConsumerGroup = process.env.EventHubConsumerGroup;
const eventHubConsumerGroup = "plan-iot-consumer";
console.log(eventHubConsumerGroup);
if (!eventHubConsumerGroup) {
  console.error(`Environment variable EventHubConsumerGroup must be specified.`);
  return;
}
console.log(`Using event hub consumer group [${eventHubConsumerGroup}]`);

// const targetDevice = process.env.TargetDevice;
const targetDevice = "hack-plant-rasp-device"
console.log(targetDevice);
if (!targetDevice) {
  console.error(`Environment variable TargetDevice must be specified.`);
  return;
}
console.log(`Using target device [${targetDevice}]`);

// Redirect requests to the public subdirectory to the root
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
// app.use((req, res /* , next */) => {
//   res.redirect('/');
// });

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/water-the-plant', (req, res) => {
  // publishCommandToWaterThePlant(iotHubConnectionString, targetDevice);
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
      serviceClient.send(targetDevice, message, printResultFor(res));
    }
  });

});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        console.log(`Broadcasting data ${data}`);
        client.send(data);
      } catch (e) {
        console.error(e);
      }
    }
  });
};

server.listen(process.env.PORT || '3000', () => {
  console.log('Listening on %d.', server.address().port);
});

const eventHubReader = new EventHubReader(iotHubConnectionString, eventHubConsumerGroup);

(async () => {
  await eventHubReader.startReadMessage((message, date, deviceId) => {
    try {
      const payload = {
        IotData: message,
        MessageDate: date || Date.now().toISOString(),
        DeviceId: deviceId,
      };

      wss.broadcast(JSON.stringify(payload));
    } catch (err) {
      console.error('Error broadcasting: [%s] from [%s].', err, message);
    }
  });
})().catch();

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