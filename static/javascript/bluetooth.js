alert("test");
var button = document.findElementById("pair");
button.addEventListener('pointerup', function(event) {
	navigator.bluetooth.requestDevice({acceptAllDevices: true})
         .then(device => {
              console.log(device);
         });
});

