"use strict";

var btServer;
var btService;
var btCharacteristic;
var btDevice;
const PRIMARY_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
var omdConnected = false;

const kCodeToMode = {
  100: "BALANCE",
  101: "OMD",
  102: "AXE_550_CALIBRATE",
  103: "OFF",
};

const MAX_GO_VALUE = 120;
const MIN_GO_VALUE = 0;

async function connect() {
  exponentialBackoff(50 /* max retries */, 2 /* seconds delay */,
    async function toTry() {
      time('Connecting to Bluetooth Device... ');
      await btDevice.gatt.connect();
    },
    function success() {
      console.log('> Bluetooth Device connected. Try disconnect it now.');
    },
    function fail() {
      time('Failed to reconnect.');
    });
}

function onDisconnected() {
  console.log('> Bluetooth Device disconnected');
  omdConnected = false;
  $("#pair").show();
  $("#disconnect").hide();
  connect();
}

/* Utils */

// This function keeps calling "toTry" until promise resolves or has
// retried "max" number of times. First retry has a delay of "delay" seconds.
// "success" is called upon success.
async function exponentialBackoff(max, delay, toTry, success, fail) {
  try {
    const result = await toTry();
    success(result);
  } catch(error) {
    if (max === 0) {
      return fail();
    }
    time('Retrying in ' + delay + 's... (' + max + ' tries left)');
    setTimeout(function() {
      exponentialBackoff(--max, delay * 2, toTry, success, fail);
    }, delay * 1000);
  }
}

function time(text) {
  console.log('[' + new Date().toJSON().substr(11, 8) + '] ' + text);
}

$(document).ready(function() {
  $(".mode select").on('change', function() {
    var mode = this.value;
    var modeCode = Object.keys(kCodeToMode).find(key => kCodeToMode[key] === mode);

    if (!mode || !modeCode) {
      alert("Mode not recognized");
      return;
    }

    sendToOMDDevice({
      mode: mode
    });
  });

  $(".on-sequence button").on('click', function() {
    var value = $(".on-sequence input").val();

    if (value > 1000) {
      alert("Cannot increase on sequence beyond 1000ms");
      return;
    }

    if (value < 50) {
      alert("Cannot increase on sequence less than 50ms");
      return;
    }

    sendToOMDDevice({
      on: (value/10).toString()
    });

    $(".on-sequence input").val("");
  });

  $(".off-sequence button").on('click', function() {
    var value = $(".off-sequence input").val();
    sendToOMDDevice({
      off: (value/10).toString()
    });
    $(".off-sequence input").val("");
  });

  $(".speed button").on('click', function() {
    var value = $($($($($(this).parent()[0]).prev()[0])[0])[0]).children().val()
    var esc = $(this).data("label");

    if (value > MAX_GO_VALUE) {
      alert(`Can't go above ${MAX_GO_VALUE}`);
      return;
    }

    if (value < MIN_GO_VALUE) {
      alert(`Can't go blow ${MIN_GO_VALUE}`);
      return;
    }

    sendToOMDDevice({
      [`${esc}Speed`]: value
    });

    $(this).val(value);
  });

  $(".shutdown button").on('click', function() {
    var value = this.value;
    sendToOMDDevice({
      mode: "OFF"
    });
  });

  var button = document.getElementById("pair");
  console.log({button});
  button.addEventListener('touchend', function(event) {
    navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [PRIMARY_SERVICE_UUID]
      })
      .then(device => {
        btDevice = device;
        btDevice.addEventListener('gattserverdisconnected', onDisconnected);
        return btDevice.gatt.connect();
      }).then((server) => {
        omdConnected = true;
        btServer = server;
        $("#pair").hide();
        $("#disconnect").show();
        return server.getPrimaryService(PRIMARY_SERVICE_UUID);
      }).then((service) => {
        btService = service;
        return service.getCharacteristic(CHARACTERISTIC_UUID);
      }).then((characteristic) => {
        btCharacteristic = characteristic;
        btCharacteristic.startNotifications();
        //setTimeout(() => characteristic.writeValue(encode(json)), 500);
      }).then(characteristic => {
        btCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
        console.log('Notifications have been started.');
        sendToOMDDevice({
          op: "INIT"
        });
      });
  });

  function handleCharacteristicValueChanged(event) {
    const value = event.target.value;
    var enc = new TextDecoder("utf-8");
    var jsonStringified = enc.decode(value);
    var json = JSON.parse(jsonStringified);
    console.log(json);
    processData(json);
  }

  function sendToOMDDevice(json) {
    if (!btCharacteristic) {
      alert("Can't send. Lost connection or not connected");
      return;
    }

    btCharacteristic.writeValue(encode(json));
  }

  function processData(json) {
    if (json["temp"]) {
      $(".temperature .reading").html(json["temp"]);
    }

    if (json["min"]) {
      $(".min .reading").html(json["min"]);
    }

    if (json["max"]) {
      $(".max .reading").html(json["max"]);
    }

    if (json["esc1"]) {
      $(".esc1 input").val(json["esc1"]);
    }

    if (json["esc2"]) {
      $(".esc2 input").val(json["esc2"]);
    }

    if (json["esc3"]) {
      $(".esc3 input").val(json["esc3"]);
    }

    if (json["balance"]) {
      $(".balance input").val(json["balance"]);
    }

    if (json["mode"]) {
      var modeCode = json["mode"];
      var mode = kCodeToMode[modeCode];
      $(".mode select").val(mode);
    }

    if (json["on"]) {
      var on = json["on"];
      $(".on-sequence input").val(on*10);
    }

    if (json["off"]) {
      var off = json["off"];
      $(".off-sequence input").val(off*10);
    }
  }

  function encode(json) {
    return new TextEncoder().encode(`<${JSON.stringify(json)}>`);
  }
});
