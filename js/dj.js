var dingbuffer = null;
var revdingbuffer = null;

function playSound(buffer) {
  var source = audioContext.createBufferSource(); // creates a sound source
  source.buffer = buffer;                    // tell the source which sound to play
  source.connect(audioContext.destination);       // connect the source to the context's destination (the speakers)
  source.noteOn(0);                          // play the source now
}

function crossfade(value) {
  // equal-power crossfade
  var gain1 = Math.cos(value * 0.5*Math.PI);
  var gain2 = Math.cos((1.0-value) * 0.5*Math.PI);

  leftTrack.xfadeGain.gain.value = gain1;
  rightTrack.xfadeGain.gain.value = gain2;
}

// logResponse gives us a more "musical" frequency response
// for filter frequency, etc, for a control dial - it gives a
// 2^x exponential curve response for an input of [0,1], returning [0,1].
function logResponse( input ) {
   return ( Math.pow(2,((input*4)-1)) - 0.5)/7.5;
}

function cue(event) {
  event.target.classList.add("active");
}


//init: create plugin
window.addEventListener('load', function() {
  audioContext = new webkitAudioContext();

  leftTrack = new Track( "sounds/TheUnderworld.ogg" );
  rightTrack = new Track( "sounds/RapidArc.ogg" );

  var request = new XMLHttpRequest();
  request.open("GET", "sounds/ding.ogg", true);
  request.responseType = "arraybuffer";
  request.onload = function() {
    audioContext.decodeAudioData( request.response, function(buffer) { 
        dingbuffer = buffer;
        revdingbuffer = reverseBuffer(buffer);
    } );
  }
  request.send();

  // Start initializing MIDI
  navigator.getMIDIAccess( onMIDIInit, onMIDIFail );
  
});
