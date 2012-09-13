var midiAccess = null;
var midiIn = null;
var midiOut = null;
var filterTrack = null;
var selectMIDIIn = null;
var selectMIDIOut = null;

function turnOffLeftPlayButton() {
  if (midiOut)
    midiOut.sendMessage( 0x80, 0x3b, 0x01 );
}

function turnOffRightPlayButton() {
  if (midiOut)
    midiOut.sendMessage( 0x80, 0x42, 0x01 );
}

function midiMessageReceived(msgs) {
  for (var i=0; i<msgs.length; i++ ) {
    var cmd = msgs[i].data[0] >> 4;
    // var channel = msgs[i].data[0] & 0xf;

    var noteNumber = msgs[i].data[1];
    var velocity = msgs[i].data[2];

    if ( cmd==8 || ((cmd==9)&&(velocity==0)) ) { // with MIDI, note on with velocity zero is the same as note off
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
            if (midiOut)
              midiOut.sendMessage( (leftTrack.isPlaying) ? 0x90 : 0x80,0x3b,0x01);
            leftTrack.onPlaybackEnd = turnOffLeftPlayButton;
          } else {
            leftTrack.setCuePointAtCurrentTime();
            // light up the Deck A cue button
            if (midiOut)
              midiOut.sendMessage( 0x90, 0x33, 0x01 );
          }
          break;
        case 0x3b:  // Deck A play/pause
          leftTrack.cuePointIsActive = false;
          leftTrack.onPlaybackEnd = turnOffLeftPlayButton;
          leftTrack.togglePlayback();
          if (midiOut)
            midiOut.sendMessage( (leftTrack.isPlaying) ? 0x90 : 0x80,0x3b,0x01);
          break;
        case 0x40:  // Deck A sync
          break;
        case 0x65:  // Deck A PFL
          if (filterTrack == leftTrack) {
            filterTrack = null;
            if (midiOut)
              midiOut.sendMessage( 0x80, 0x65, 0x01 );
          } else {
            filterTrack = leftTrack;
            if (midiOut)
              midiOut.sendMessage( 0x90, 0x65, 0x01 );
          }
          if (midiOut)
            midiOut.sendMessage( 0x80, 0x66, 0x01 );
          break;
        case 0x4b:  // Deck A load
          break;
        case 0x43:  // Deck A pitch bend +
          leftTrack.setCuePointEndAtCurrentTime();
          break;
        case 0x44:  // Deck A pitch bend -
          leftTrack.clearCuePoint();
          // un-light up the Deck A cue button
          if (midiOut)
            midiOut.sendMessage( 0x80, 0x33, 0x01 );
          break;

        // Deck B buttons
        case 0x3c:  // Deck B cue
          if (rightTrack.cuePoint) {
            // jump to cuePoint
            rightTrack.jumpToCuePoint();
            if (midiOut)
              midiOut.sendMessage( (rightTrack.isPlaying) ? 0x90 : 0x80,0x42,0x01);
            rightTrack.onPlaybackEnd = turnOffRightPlayButton;
          } else {
            rightTrack.setCuePointAtCurrentTime();
            // light up the Deck B cue button
            if (midiOut)
              midiOut.sendMessage( 0x90, 0x3c, 0x01 );
            rightTrack.cueButton.classList.add("active");
          }
          break;
        case 0x42:  // Deck B play/pause
          rightTrack.cuePointIsActive = false;
          rightTrack.onPlaybackEnd = turnOffRightPlayButton;
          rightTrack.togglePlayback();
          if (midiOut)
            midiOut.sendMessage( (rightTrack.isPlaying) ? 0x90 : 0x80,0x42,0x01);
          break;
        case 0x47:  // Deck B sync
          break;
        case 0x66:  // Deck B PFL - select deck B for filter
          if (filterTrack == rightTrack) {
            filterTrack = null;
            if (midiOut)
              midiOut.sendMessage( 0x80, 0x66, 0x01 );
          } else {
            filterTrack = rightTrack;
            if (midiOut)
              midiOut.sendMessage( 0x90, 0x66, 0x01 );
          }
          if (midiOut)
            midiOut.sendMessage( 0x80, 0x65, 0x01 );
          break;
        case 0x34:  // Deck B load
          break;
        case 0x45:  // Deck B pitch bend +
          rightTrack.setCuePointEndAtCurrentTime();
          break;
        case 0x46:  // Deck B pitch bend -
          rightTrack.clearCuePoint();
          // un-light up the Deck B cue button
          if (midiOut)
            midiOut.sendMessage( 0x80, 0x3c, 0x01 );
          break;
      }
    } else if (cmd == 11) { // Continuous Controller message
      switch (noteNumber) {
        case 0x08: // Deck A volume
          var val = velocity/64.0;
          leftTrack.gainSlider.value = val;
          leftTrack.changeGain( val );
          break;

        case 0x09: // Deck B volume
          var val = velocity/64.0;
          rightTrack.gainSlider.value = val;
          rightTrack.changeGain( val );
          break;

        case 0x0a: // Crossfader
          var val = velocity/127.0;
          crossfade(val);
          document.getElementById("xfader").value = val;
          break;

        case 0x0b: // Headphone gain - filter resonance
          if (filterTrack)
            filterTrack.filter.Q.value = ( velocity / 127.0 ) * 20;
          break;

        case 0x0d: // Deck A Pitch:  range of 0.92 - 1.08 (+/- 8%)
          leftTrack.pbrSlider.value = 0.92 + 0.16 * velocity / 127.0;
          leftTrack.changePlaybackRate( leftTrack.pbrSlider.value );
          break;

        case 0x0e: // Deck B Pitch:  range of 0.92 - 1.08 (+/- 8%)
          rightTrack.pbrSlider.value = 0.92 + 0.16 * velocity / 127.0;
          rightTrack.changePlaybackRate( rightTrack.pbrSlider.value );
          break;

        case 0x17: // Master Gain - filter frequency
          if (filterTrack)
            filterTrack.filter.frequency.value = logResponse( velocity / 127.0 ) * 20000.0;
          break;

        case 0x1a: // Browse wheel
          if (velocity>63) {
            // wheel -1
            playSound(revdingbuffer);
          } else {
            // wheel +1
            playSound(dingbuffer);
          }
          break;

        case 0x19: // Deck A wheel (shuttle)
          if (velocity>63) {
            // wheel -1
            leftTrack.skip(-1);
          } else {
            // wheel +1
            leftTrack.skip(1);
          }
          break;

        case 0x18: // Deck B wheel (shuttle)
          if (velocity>63) {
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
}

function changeMIDIPort() {
  var list=midiAccess.enumerateInputs();
  midiIn = midi.getInput( list[ selectMIDI.selectedIndex ] );
  midiIn.onmessage = midiMessageReceived;
}

function changeMIDIIn( ev ) {
  var list=midi.enumerateInputs();
  var selectedIndex = ev.target.selectedIndex;

  if (list.length >= selectedIndex) {
    midiIn = midi.getInput( list[selectedIndex] );
    midiIn.onmessage = midiMessageReceived;
  }
}

function changeMIDIOut( ev ) {
  var list=midi.enumerateOutputs();
  var selectedIndex = ev.target.selectedIndex;

  if (list.length >= selectedIndex)
    midiOut = midi.getOutput( list[selectedIndex] );
}

function onMIDIInit( midi ) {
  var preferredIndex = 0;
  midiAccess = midi;
  selectMIDIIn=document.getElementById("midiIn");
  selectMIDIOut=document.getElementById("midiOut");

  var list=midi.enumerateInputs();

  // clear the MIDI input select
  selectMIDIIn.options.length = 0;

  for (var i=0; i<list.length; i++)
    if (list[i].name.toString().indexOf("DJ") != -1)
      preferredIndex = i;

  if (list.length) {
    for (var i=0; i<list.length; i++)
      selectMIDIIn.options[i]=new Option(list[i].name,list[i].fingerprint,i==preferredIndex,i==preferredIndex);

    midiIn = midi.getInput( list[preferredIndex] );
    midiIn.onmessage = midiMessageReceived;

    selectMIDIIn.onchange = changeMIDIIn;
  }

  // clear the MIDI output select
  selectMIDIOut.options.length = 0;
  preferredIndex = 0;
  list=midi.enumerateOutputs();

  for (var i=0; i<list.length; i++)
    if (list[i].name.toString().indexOf("DJ") != -1)
      preferredIndex = i;

  if (list.length) {
    for (var i=0; i<list.length; i++)
      selectMIDIOut.options[i]=new Option(list[i].name,list[i].fingerprint,i==preferredIndex,i==preferredIndex);

    midiOut = midi.getOutput( list[preferredIndex] );
    selectMIDIOut.onchange = changeMIDIOut;
  }

  // clear all the LEDs
  if (midiOut) {
    midiOut.sendMessage( 0x80,0x3b,0x01 ); // Deck A play/pause
    midiOut.sendMessage( 0x80,0x33,0x01 ); // Deck A cue
    midiOut.sendMessage( 0x80,0x40,0x01 ); // Deck A sync
    midiOut.sendMessage( 0x80,0x65,0x01 ); // Deck A PFL
    midiOut.sendMessage( 0x80,0x42,0x01 ); // Deck B play/pause
    midiOut.sendMessage( 0x80,0x3c,0x01 ); // Deck B cue
    midiOut.sendMessage( 0x80,0x47,0x01 ); // Deck B sync
    midiOut.sendMessage( 0x80,0x66,0x01 ); // Deck B PFL
  }

}

function onMIDIFail( err ) {

}
