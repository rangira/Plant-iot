/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // A class for holding the last N points of telemetry for a device
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 10;
      this.timeData = new Array(this.maxLen);
      this.moistureData = new Array(this.maxLen);
      this.luminosityData = new Array(this.maxLen);
    }

    addData(time, moisture, luminosity) {
      this.timeData.push(time);
      this.moistureData.push(moisture);
      this.luminosityData.push(luminosity || null);
      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.moistureData.shift();
        this.luminosityData.shift();
      }
    }
  }

  // All the devices in the list (those that have been sending telemetry)
  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    // Find a device based on its Id
    findDevice(deviceId) {
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }

      return undefined;
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Define the chart axes
  const chartData = {
    datasets: [
      {
        fill: false,
        label: 'Moisture',
        yAxisID: 'moisture',
        borderColor: 'rgba(255, 204, 0, 1)',
        pointBoarderColor: 'rgba(255, 204, 0, 1)',
        backgroundColor: 'rgba(255, 204, 0, 0.4)',
        pointHoverBackgroundColor: 'rgba(255, 204, 0, 1)',
        pointHoverBorderColor: 'rgba(255, 204, 0, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Luminosity',
        yAxisID: 'luminosity',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.4)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [{
        id: 'moisture',
        type: 'linear',
        scaleLabel: {
          labelString: 'Moisture (%)',
          display: true,
        },
        position: 'left',
      },
      {
        id: 'luminosity',
        type: 'linear',
        scaleLabel: {
          labelString: 'Luminosity (%)',
          display: true,
        },
        position: 'right',
      }]
    }
  };

  // Get the context of the canvas element we want to select
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
      backgroundColor: "#f1f1f1",
    });

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const luminositytext = document.getElementById('luminosityid');
  const moisturetext = document.getElementById('moistureid');
  const listOfDevices = document.getElementById('listOfDevices'); 
  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.moistureData;
    chartData.datasets[1].data = device.luminosityData;
    moisturetext.innerText= 'Moisture: '+ device.moistureData[device.moistureData.length-1];
    luminositytext.innerText='Luminosity: '+ device.luminosityData[device.luminosityData.length-1];
    myLineChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  const MinLum = 20;
  const MinMois = 20;

  function alertDisplay(Type) {
    const AlertNot = document.getElementById("alert1");

    if(Type=="Mois")
      {
        AlertNot.children[2].innerText="Moisture has";
        AlertNot.children[3].innerText=MinMois+"%";
      }
    else if(Type=="Lum")
      {
        AlertNot.children[2].innerText="Luminosity has";
        AlertNot.children[3].innerText=MinLum+"%";
      }
    else
      {
        AlertNot.children[2].innerText="Luminosity & Moisture have";
        AlertNot.children[3].innerText="minimum specified value";
      }

    AlertNot.style.display= "block";
    AlertNot.firstElementChild.style.display = "block";
    console.log(AlertNot.children[2]);
  }

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and moisture
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData);

      // time and either moisture or luminosity are required
      if (!messageData.MessageDate || (!messageData.IotData.moisture && !messageData.IotData.luminosity)) {
        return;
      }

      // find or add device to list of tracked devices
      const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

      if (existingDeviceData) 
      {
          existingDeviceData.addData(messageData.MessageDate, messageData.IotData.moisture, messageData.IotData.luminosity);          
      } else {
        const newDeviceData = new DeviceData(messageData.DeviceId);
        trackedDevices.devices.push(newDeviceData);
        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;
        newDeviceData.addData(messageData.MessageDate, messageData.IotData.moisture, messageData.IotData.luminosity);        
        // add device to the UI list
        const node = document.createElement('option');
        const nodeText = document.createTextNode(messageData.DeviceId);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        // if this is the first device being discovered, auto-select it
        if (needsAutoSelect) {
          needsAutoSelect = false;
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }

        //Add data to display
        if(messageData.IotData.luminosity)
        luminositytext.innerText='Luminosity: '+ messageData.IotData.luminosity;
        if(messageData.IotData.moisture)
        moisturetext.innerText= 'Moisture: '+ messageData.IotData.moisture ;
     
        //Alert notification if Luminosity and Moisture falls below min specified value.
        if(messageData.IotData.luminosity <= MinLum && messageData.IotData.moisture <= MinMois)
        alertDisplay("MoisLum");
     
        else if(messageData.IotData.moisture <= MinMois)
        alertDisplay("Mois");
     
        else if(messageData.IotData.luminosity <= MinLum)
        alertDisplay("Lum");

      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});
