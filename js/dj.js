var dingbuffer = null;
var revdingbuffer = null;

function playSound(buffer) {
  var source = audioCtx.createBufferSource(); // creates a sound source
  source.buffer = buffer;                    // tell the source which sound to play
  source.connect(masterGain);       // connect the source to the context's destination (the speakers)
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
  var track = event.target.parentNode.track;

  // TODO: should handle the MIDI sends here
  if (track.cuePoint) {
    // jump to cuePoint
    track.jumpToCuePoint();
  } else {
    track.setCuePointAtCurrentTime();
    event.target.classList.add("active");
  }
  event.preventDefault();
}

function handleFileDrop(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  console.log( "Dropped: " + evt.dataTransfer.files[0].name );
} 

//init: create plugin
window.addEventListener('load', function() {
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.connect( audioCtx.destination );
  runningDisplayContext = document.getElementById("wavedisplay").getContext("2d");

  leftTrack = new Track( "sounds/TheUnderworld.ogg", true );
  rightTrack = new Track( "sounds/RapidArc.ogg", false );

  var request = new XMLHttpRequest();
  request.open("GET", "sounds/ding.ogg", true);
  request.responseType = "arraybuffer";
  request.onload = function() {
    audioCtx.decodeAudioData( request.response, function(buffer) { 
        dingbuffer = buffer;
        revdingbuffer = reverseBuffer(buffer);
    } );
  }
  request.send();
  tracks = document.getElementById( "trackContainer" );
  updatePlatters( 0 );

  window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;

  // Start initializing MIDI
  if (navigator.requestMIDIAccess)
    navigator.requestMIDIAccess().then( onMIDIInit, onMIDIFail );
});

var rafID = null;
var tracks = null;

function updatePlatters( time ) {
  runningDisplayContext.clearRect(0,0,RUNNING_DISPLAY_WIDTH,RUNNING_DISPLAY_HEIGHT);
  for (var i=0; i<tracks.children.length; i++)
    tracks.children[i].track.updatePlatter( true );

  rafID = window.requestAnimationFrame( updatePlatters );
}
