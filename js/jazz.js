var IE = false;
if(navigator.appName=='Microsoft Internet Explorer')
	var IE=true;
var Jazz;
var active_element;
var current_in;
var msg;
var selectedIn;
var selectedOut;
var lastNote = -1;
var filterTrack = null;

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

function turnOffLeftPlayButton() {
  Jazz.MidiOut( 0x80, 0x3b, 0x01 );
}

function turnOffRightPlayButton() {
  Jazz.MidiOut( 0x80, 0x42, 0x01 );
}

function midiProc(t,a,b,c) {
  var cmd = a >> 4;
  var channel = a & 0xf;

  var noteNumber = b;

  if ( cmd==8 || ((cmd==9)&&(c==0)) ) { // with MIDI, note on with velocity zero is the same as note off
    // note off
    //noteOff(b);
  } else if (cmd == 9) {  // Note on
    switch (noteNumber) {
      // General buttons
      case 0x59:  // Back
        break;
      case 0x5a:  // Enter
        break;

      // Deck A buttons
      case 0x33:  // Deck A cue
        if (leftTrack.cuePoint) {
          // jump to cuePoint
          leftTrack.jumpToCuePoint();
          // light up the play button
          Jazz.MidiOut( (leftTrack.isPlaying) ? 0x90 : 0x80,0x3b,0x01);
          leftTrack.onPlaybackEnd = turnOffLeftPlayButton;
        } else {
          leftTrack.setCuePointAtCurrentTime();
          // light up the Deck A cue button
          Jazz.MidiOut( 0x90, 0x33, 0x01 );
        }
        break;
      case 0x3b:  // Deck A play/pause
        leftTrack.cuePointIsActive = false;
        leftTrack.onPlaybackEnd = turnOffLeftPlayButton;
        leftTrack.togglePlayback();
        Jazz.MidiOut( (leftTrack.isPlaying) ? 0x90 : 0x80,0x3b,0x01);
        break;
      case 0x40:  // Deck A sync
        break;
      case 0x65:  // Deck A PFL
        if (filterTrack == leftTrack) {
          filterTrack = null;
          Jazz.MidiOut( 0x80, 0x65, 0x01 );
        } else {
          filterTrack = leftTrack;
          Jazz.MidiOut( 0x90, 0x65, 0x01 );
        }
        Jazz.MidiOut( 0x80, 0x66, 0x01 );
        break;
      case 0x4b:  // Deck A load
        break;
      case 0x43:  // Deck A pitch bend +
        leftTrack.setCuePointEndAtCurrentTime();
        break;
      case 0x44:  // Deck A pitch bend -
        leftTrack.clearCuePoint();
        // un-light up the Deck A cue button
        Jazz.MidiOut( 0x80, 0x33, 0x01 );
        break;

      // Deck B buttons
      case 0x3c:  // Deck B cue
        if (rightTrack.cuePoint) {
          // jump to cuePoint
          rightTrack.jumpToCuePoint();
          Jazz.MidiOut( (rightTrack.isPlaying) ? 0x90 : 0x80,0x42,0x01);
          rightTrack.onPlaybackEnd = turnOffRightPlayButton;
        } else {
          rightTrack.setCuePointAtCurrentTime();
          // light up the Deck B cue button
          Jazz.MidiOut( 0x90, 0x3c, 0x01 );
          rightTrack.cueButton.classList.add("active");
        }
        break;
      case 0x42:  // Deck B play/pause
        rightTrack.cuePointIsActive = false;
        rightTrack.onPlaybackEnd = turnOffRightPlayButton;
        rightTrack.togglePlayback();
        Jazz.MidiOut( (rightTrack.isPlaying) ? 0x90 : 0x80,0x42,0x01);
        break;
      case 0x47:  // Deck B sync
        break;
      case 0x66:  // Deck B PFL - select deck B for filter
        if (filterTrack == rightTrack) {
          filterTrack = null;
          Jazz.MidiOut( 0x80, 0x66, 0x01 );
        } else {
          filterTrack = rightTrack;
          Jazz.MidiOut( 0x90, 0x66, 0x01 );
        }
        Jazz.MidiOut( 0x80, 0x65, 0x01 );
        break;
      case 0x34:  // Deck B load
        break;
      case 0x45:  // Deck B pitch bend +
        rightTrack.setCuePointEndAtCurrentTime();
        break;
      case 0x46:  // Deck B pitch bend -
        rightTrack.clearCuePoint();
        // un-light up the Deck B cue button
        Jazz.MidiOut( 0x80, 0x3c, 0x01 );
        break;
    }
  } else if (cmd == 11) { // Continuous Controller message
    switch (b) {
      case 0x08: // Deck A volume
        var val = c/64.0;
        leftTrack.gainSlider.value = val;
        leftTrack.changeGain( val );
        break;

      case 0x09: // Deck B volume
        var val = c/64.0;
        rightTrack.gainSlider.value = val;
        rightTrack.changeGain( val );
        break;

      case 0x0a: // Crossfader
        var val = c/127.0;
        crossfade(val);
        document.getElementById("xfader").value = val;
        break;

      case 0x0b: // Headphone gain - filter resonance
        if (filterTrack)
          filterTrack.filter.Q.value = ( c / 127.0 ) * 50;
        break;

      case 0x0d: // Deck A Pitch:  range of 0.92 - 1.08 (+/- 8%)
        leftTrack.pbrSlider.value = 0.92 + 0.16 * c / 127.0;
        leftTrack.changePlaybackRate( leftTrack.pbrSlider.value );
        break;

      case 0x0e: // Deck B Pitch:  range of 0.92 - 1.08 (+/- 8%)
        rightTrack.pbrSlider.value = 0.92 + 0.16 * c / 127.0;
        rightTrack.changePlaybackRate( rightTrack.pbrSlider.value );
        break;

      case 0x17: // Master Gain - filter frequency
        if (filterTrack)
          filterTrack.filter.frequency.value = logResponse( c / 127.0 ) * 20000.0;
        break;

      case 0x1a: // Browse wheel
        if (c>63) {
          // wheel -1
          playSound(revdingbuffer);
        } else {
          // wheel +1
          playSound(dingbuffer);
        }
        break;

      case 0x19: // Deck A wheel (shuttle)
        if (c>63) {
          // wheel -1
          leftTrack.skip(-1);
        } else {
          // wheel +1
          leftTrack.skip(1);
        }
        break;

      case 0x18: // Deck B wheel (shuttle)
        if (c>63) {
          // wheel -1
          rightTrack.skip(-1);
        } else {
          // wheel +1
          rightTrack.skip(1);
        }
        break;

    }
  }
}

function midiString(a,b,c){
 var cmd=Math.floor(a/16);
 var note=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][b%12]+Math.floor(b/12);
 a=a.toString(16);
 b=(b<16?'0':'')+b.toString(16);
 c=(c<16?'0':'')+c.toString(16);
 var str=a+" "+b+" "+c+"    ";
 if(cmd==8){
  str+="Note Off   "+note;
 }
 else if(cmd==9){
  str+="Note On    "+note;
 }
 else if(cmd==10){
  str+="Aftertouch "+note;
 }
 else if(cmd==11){
  str+="Control    "+b;
 }
 else if(cmd==12){
  str+="Program    "+b;
 }
 else if(cmd==13){
  str+="Aftertouch";
 }
 else if(cmd==14){
  str+="Pitch Wheel";
 }
 return str;
}

//// Listbox
function changeMidiIn(){
 try{
  if(selectedIn.selectedIndex){
   current_in=Jazz.MidiInOpen(selectedIn.options[selectedIn.selectedIndex].value,midiProc);
  } else {
   Jazz.MidiInClose(); current_in='';
  }
  for(var i=0;i<selectedIn.length;i++){
   if(selectedIn[i].value==current_in) selectedIn[i].selected=1;
  }
 }
 catch(err){}
}

function changeMidiOut(){
  if(selectedOut.selectedIndex)
   Jazz.MidiOutOpen(selectedOut.options[selectedOut.selectedIndex].value);
}

//// Connect/disconnect
function connectMidiIn(){
 try{
  var str=Jazz.MidiInOpen(current_in,midiProc);
  for(var i=0;i<sel.length;i++){
   if(sel[i].value==str) sel[i].selected=1;
  }
 }
 catch(err){}
}

function disconnectMidiIn(){
 try{
  Jazz.MidiInClose(); sel[0].selected=1;
 }
 catch(err){}
}

function onFocusIE(){
 active_element=document.activeElement;
 connectMidiIn();
}
function onBlurIE(){
 if(active_element!=document.activeElement){ active_element=document.activeElement; return;}
 disconnectMidiIn();
}

var dingbuffer = null;
var revdingbuffer = null;

//init: create plugin
window.addEventListener('load', function() {




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

  Jazz = document.createElement("object");
  Jazz.style.position="absolute";
  Jazz.style.visibility="hidden";

  if (IE) {
    Jazz.classid = "CLSID:1ACE1618-1C7D-4561-AEE1-34842AA85E90";
  } else {
    Jazz.type="audio/x-jazz";
  }

  var fallback = document.createElement("a");
  fallback.style.visibility="visible";
  fallback.style.background="white";
  fallback.style.font="20px Arial,sans-serif";
  fallback.style.padding="20px";
  fallback.style.position="relative";
  fallback.style.top="20px";
  fallback.style.zIndex="100";
  fallback.style.border="2px solid red";
  fallback.style.borderRadius="5px";
  fallback.appendChild(document.createTextNode("This page requires the Jazz MIDI Plugin."));
  fallback.href = "http://jazz-soft.net/";
  Jazz.appendChild(fallback);

  document.body.insertBefore(Jazz,document.body.firstChild);

  selectedIn=document.getElementById("midiIn");
  selectedOut=document.getElementById("midiOut");
  try{
    current_in=Jazz.MidiInOpen(0,midiProc);
    var list=Jazz.MidiInList();
    for(var i in list){
      selectedIn[selectedIn.options.length]=new Option(list[i],list[i],list[i]==current_in,list[i]==current_in);
    }

    list=Jazz.MidiOutList();
    for(var i in list)
      selectedOut[i]=new Option(list[i],list[i],i==0,i==0);

    // Find the interface named the same as the input (e.g. "Numark DJ2Go")
    var interfaceName = selectedIn.options[selectedIn.selectedIndex].value;
    for (var i=0; i<selectedOut.options.length; i++) {
      if (selectedOut.options[i].value == interfaceName ) {
        selectedOut.selectedIndex = i;
        Jazz.MidiOutOpen(interfaceName);
      }
    }

  }
  catch(err){}

  // clear all the LEDs
  Jazz.MidiOut( 0x80,0x3b,0x01 ); // Deck A play/pause
  Jazz.MidiOut( 0x80,0x33,0x01 ); // Deck A cue
  Jazz.MidiOut( 0x80,0x40,0x01 ); // Deck A sync
  Jazz.MidiOut( 0x80,0x65,0x01 ); // Deck A PFL
  Jazz.MidiOut( 0x80,0x42,0x01 ); // Deck B play/pause
  Jazz.MidiOut( 0x80,0x3c,0x01 ); // Deck B cue
  Jazz.MidiOut( 0x80,0x47,0x01 ); // Deck B sync
  Jazz.MidiOut( 0x80,0x66,0x01 ); // Deck B PFL

  if(navigator.appName=='Microsoft Internet Explorer'){ document.onfocusin=onFocusIE; document.onfocusout=onBlurIE;}
  else{ window.onfocus=connectMidiIn; window.onblur=disconnectMidiIn;}
});