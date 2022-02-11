"use strict";

var btServer;
var btService;
var btCharacteristic;
const PRIMARY_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
var omdConnected = false;

$(document).ready(function() {
	$(".mode select").on('change', function() {
		var mode = this.value;
		sendToOMDDevice({ mode: mode });
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

		sendToOMDDevice({ on: value });
		$(".on-sequence input").val("");
	});

	$(".off-sequence button").on('click', function() {
		var value = $(".off-sequence input").val();
		sendToOMDDevice({ off: value });
		$(".off-sequence input").val("");
	});

	$(".speed button").on('click', function() {
		var value = $(".speed input").val();

		if (value > 130) {
			alert("Can't go above 130");
			return;
		}

		if (value < 100) {
			alert("Can't go blow 100");
			return;
		}

		sendToOMDDevice({ hz: value });
		$(".speed input").val("");
	});

	$(".shutdown button").on('click', function() {
		var value = this.value;
		sendToOMDDevice({ mode: "OFF" });
	});

	var button = document.getElementById("pair");
	button.addEventListener('touchend', function(event) {
		navigator.bluetooth.requestDevice({acceptAllDevices: true, optionalServices: [PRIMARY_SERVICE_UUID]})
		 .then(device => {
				return device.gatt.connect();
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
		 });
	});

	function handleCharacteristicValueChanged(event) {
		const value = event.target.value;
		var enc = new TextDecoder("utf-8");
    var jsonStringified = enc.decode(value);
    var json = JSON.parse(jsonStringified);
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
	}

  function encode(json) {
		return new TextEncoder().encode(`<${JSON.stringify(json)}>`);
	}
});
