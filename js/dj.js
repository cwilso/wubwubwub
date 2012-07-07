var audioContext = new webkitAudioContext();

// check out hardware DJ interface - Who did Scott Schiller say made it?

var myTrack;

window.onload = function() {
	myTrack = new Track( "sounds/dream.mp3" );
};
