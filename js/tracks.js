var audioContext = new webkitAudioContext();

var leftTrack=null;
var rightTrack=null;
var FADE=0.01;

// The Track object represents an in-memory track.  In order to be able to
// reverse the playback, it also creates and keeps a reversed version of
// the track in memory.
//
// This object does not currently handle running off the ends of the buffer
// (forward or backward) very gracefully.  //TODO.
function Track( url ) {
	var thisTrack = this;
	var e = document.createElement( "div" );
	e.track = thisTrack;
	e.className = "track loading";

	// It is important that this element be the first child!
	// when we load a new file, it changes child[0].
	var nameElement = document.createElement("div");
	nameElement.className="name";
	nameElement.appendChild( document.createTextNode(url) );
	e.appendChild( nameElement );

	var cueButton = document.createElement( "div" );
	cueButton.className = "cueButton";
	cueButton.appendChild( document.createTextNode("CUE") );
	cueButton.onclick=cue;
	e.appendChild( cueButton );

	var playButton = document.createElement("button");
	playButton.appendChild( document.createTextNode("play") );
	playButton.onclick=function(e) { 
		if (this.parentNode.track) 
			this.innerText = this.parentNode.track.togglePlaybackSpinUpDown()
	};
	e.appendChild( playButton );

	e.appendChild( document.createElement("br") );
	e.appendChild( document.createTextNode("rate") );

	var pbrSlider = document.createElement("input");
	pbrSlider.className = "slider";
	pbrSlider.type = "range";
	pbrSlider.min = "-2";
	pbrSlider.max = "2";
	pbrSlider.step = "0.01";
	pbrSlider.value = "1";
	pbrSlider.oninput = function(event) {
		this.parentNode.track.changePlaybackRate(event.target.value);
	};
	e.appendChild( pbrSlider );

	var pbrText = document.createElement( "span" );
	pbrText.appendChild( document.createTextNode("1.00"));
	e.appendChild( pbrText );
	this.pbrText = pbrText;

	e.appendChild( document.createElement("br") );
	e.appendChild( document.createTextNode("gain") );

	var gainSlider = document.createElement("input");
	gainSlider.className = "slider";
	gainSlider.type = "range";
	gainSlider.min = "0";
	gainSlider.max = "2";
	gainSlider.step = "0.01";
	gainSlider.value = "1";
	gainSlider.oninput = function(event) {
		this.parentNode.track.changeGain(event.target.value);
	};
	e.appendChild( gainSlider );

	var gainText = document.createElement( "span" );
	gainText.appendChild( document.createTextNode("1.00"));
	e.appendChild( gainText );
	this.gainText = gainText;

	var deck = document.createElement( "div" );
	deck.className = "deck";
	var disc = document.createElement( "div" );
	disc.className = "disc";
	var platter = document.createElement( "div" );
	platter.className = "platter";
	platter.appendChild( document.createTextNode("wubwubwub") );
	this.platter = platter;
	this.platter.style.webkitTransform = "rotate(0deg)";

	disc.appendChild( platter );
	deck.appendChild( disc );
	e.appendChild( deck );

	document.getElementById( "trackContainer" ).appendChild(e);
	this.trackElement = e;
	e.ondragenter = function () { 
		e.classList.add("droptarget"); 
		return false; };
	e.ondragleave = function () { e.classList.remove("droptarget"); return false; };
	e.ondrop = function (ev) {
  		ev.preventDefault();
		e.classList.remove("droptarget");
  		e.firstChild.innerText = ev.dataTransfer.files[0].name;
  		e.classList.add("loading");

	  	var reader = new FileReader();
	  	reader.onload = function (event) {
	  		audioContext.decodeAudioData( event.target.result, function(buffer) {
		    	thisTrack.buffer = buffer;
		    	thisTrack.revBuffer = reverseBuffer( buffer );
		    	thisTrack.trackElement.classList.remove( "loading" );
	  		}, function(){alert("error loading!");} ); 

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(ev.dataTransfer.files[0]);
	  	return false;
	};	

	this.gain = 1.0;
	this.gainSlider = gainSlider;
	this.pbrSlider = pbrSlider;
	this.currentPlaybackRate = 1.0;
    this.lastBufferTime = 0.0;
	this.isPlaying = false;
	this.loadNewTrack( url );
	this.xfadeGain = audioContext.createGainNode();
	this.xfadeGain.gain.value = 0.5;
	this.xfadeGain.connect(audioContext.destination);
	this.filter = audioContext.createBiquadFilter();
	this.filter.frequency.value = 20000.0;
	this.filter.type = this.filter.LOWPASS;
	this.filter.connect( this.xfadeGain );
	this.cuePoint = 0.0;
	this.cueButton = cueButton;
}

function reverseBuffer( buffer ) {
	var newBuffer = audioContext.createBuffer( buffer.numberOfChannels, buffer.length, buffer.sampleRate );
	if ( newBuffer ) {
		var length = buffer.length;
		for ( var channel=0; channel<buffer.numberOfChannels; channel++) {
			var oldBuf = buffer.getChannelData( channel );
			var newBuf = newBuffer.getChannelData( channel );
			for (var i=0; i<length; i++)
				newBuf[length-i-1] = oldBuf[i];
		}
	}
	return newBuffer;
}

Track.prototype.loadNewTrack = function( url ) {
	this.buffer = null;
	this.url = url;
	var track = this;

	if (!url)
		return;

	var request = new XMLHttpRequest();
	request.open("GET", url, true);
	request.responseType = "arraybuffer";
	request.onload = function() {
	  audioContext.decodeAudioData( request.response, function(buffer) { 
	    	track.buffer = buffer;
	    	track.revBuffer = reverseBuffer( buffer );
	    	track.trackElement.classList.remove( "loading" );
		} );
	}
	request.send();
}

Track.prototype.setCuePointAtCurrentTime = function() {
	// save the current time
	this.updatePlatter();
	this.cuePoint = this.lastBufferTime;
	this.cueButton.classList.add("active");
}

Track.prototype.setCuePointEndAtCurrentTime = function() {
	// save the current time
	this.updatePlatter();
	this.cuePointEnd = this.lastBufferTime;
//	this.cueButton.classList.add("active");
}

Track.prototype.clearCuePoint = function() {
	this.cuePoint = 0.0;
	this.cueButton.classList.remove("active");
}

Track.prototype.jumpToCuePoint = function() {
	if (this.isPlaying)
		this.togglePlayback();
	this.cuePointIsActive = true;
	this.lastBufferTime = this.cuePoint;
	this.togglePlayback();
}

// play a short snippet of sound
Track.prototype.playSnippet = function() {
	var now = audioContext.currentTime;
	var snippetLength = 11.0/360.0;
	var then = now + snippetLength;	// one tick
    var sourceNode = audioContext.createBufferSource();
	var gainNode = audioContext.createGainNode();

    sourceNode.loop = false;
	gainNode.connect( this.filter );
    sourceNode.connect( gainNode );
    sourceNode.buffer = (this.currentPlaybackRate>0) ? this.buffer : this.revBuffer;
    var startTime = (this.currentPlaybackRate>0) ? this.lastBufferTime : sourceNode.buffer.duration-this.lastBufferTime;
    
    // for now, let's try full playback rate
	// sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );

	// fade the sound in and out to avoid "clicking"
    gainNode.gain.setValueAtTime( 0.0, now );
    gainNode.gain.setTargetValueAtTime( this.gain, now, FADE );
    gainNode.gain.setTargetValueAtTime( 0.0, then, FADE );

	sourceNode.noteGrainOn( now, startTime, sourceNode.buffer.duration - startTime );
	sourceNode.noteOff( then+snippetLength );
}

Track.prototype.skip = function( ticks ) {
	var restart = false;
	if (this.isPlaying) {
		restart = true;
		this.togglePlayback();
	}
	this.lastBufferTime += ticks * 11/360;
	if (this.lastBufferTime<0.0)
		this.lastBufferTime = 0.0;
	if ( restart )
		this.togglePlayback();
	  else {
	  	this.updatePlatter();
	  	this.playSnippet();
	  }
}

Track.prototype.togglePlaybackSpinUpDown = function() {
    var now = audioContext.currentTime;

	this.cuePointIsActive = false;

    if (this.isPlaying) {
        //stop playing and return
        if (this.sourceNode) {  // we may not have a sourceNode, if our PBR is zero.
	        var playback = this.sourceNode.playbackRate;
	        playback.cancelScheduledValues( now );
	        playback.setValueAtTime( playback.value, now );
	        playback.setTargetValueAtTime( 0.001, now+0.001, .3 );
	        this.gainNode.gain.setTargetValueAtTime( 0, now+1, 0.01 );
	        this.stopTime = now + 1;
 		   	this.sourceNode.noteOff( now + 2 );
	        this.sourceNode = null;
	        this.gainNode = null;
        }
        this.isPlaying = false;
        return "play";
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = this.buffer;
    sourceNode.loop = false;
    sourceNode.playbackRate.setValueAtTime( 0.001, now );
    sourceNode.playbackRate.linearRampToValueAtTime( this.currentPlaybackRate, now+1 );

	this.gainNode = audioContext.createGainNode();
	this.gainNode.connect( this.filter );
	this.gainNode.gain.value = this.gain;
    sourceNode.connect( this.gainNode );

    sourceNode.noteOn( now );
    this.sourceNode = sourceNode;
    this.isPlaying = true;
    this.lastTimeStamp = now + 0.5;		// the 0.5 is to make up for the initial 1s "spin-up" ramp.
    this.lastBufferTime = 0.0;
    this.startTime = now;
    this.stopTime = 0.0;
    this.lastPBR = this.currentPlaybackRate;

    updatePlatters( 0 );
    return "stop";
}

Track.prototype.togglePlayback = function() {
    var now = audioContext.currentTime;

    if (this.isPlaying) {
        //stop playing and return
        if (this.sourceNode) {  // we may not have a sourceNode, if our PBR is zero.
	        this.stopTime = 0;
		    this.gainNode.gain.setTargetValueAtTime( 0.0, now, FADE );
 		   	this.sourceNode.noteOff( now + FADE*4 );
 	        this.sourceNode = null;
	        this.gainNode = null;
        }
        this.isPlaying = false;
        return "play";
    }

    this.isPlaying = true;
    this.lastTimeStamp = now;
    this.startTime = now-1;	// skips our "spin-up" animation
    this.stopTime = 0;
    this.lastPBR = this.currentPlaybackRate;

    updatePlatters( 0 );
    this.changePlaybackRate(this.lastPBR);
    return "stop";
}

Track.prototype.updateTime = function( now ) {
    // update the position we're at in the buffer
    this.lastBufferTime += (now-this.lastTimeStamp) * this.lastPBR;
    this.lastTimeStamp = now;
}

Track.prototype.updatePlatter = function() {
    var now = audioContext.currentTime;
    var bufferTime;

	if (!this.isPlaying) {
		if (this.stopTime) {	// still in spin-down; 
			if (now > this.stopTime) {	// done spinning down.
				this.stopTime = 0;
				return false;
			} else {
				// bufferTime = 1/2 acceleration * t^2;  // keeping acceleration = 1 simplifies this!!
				bufferTime = now-this.stopTime;
				bufferTime = bufferTime * bufferTime;
				bufferTime = bufferTime / 2;
				bufferTime = 0.5 - bufferTime + this.lastBufferTime;
				this.lastBufferTime = bufferTime;
			}
		} else
			bufferTime = this.lastBufferTime;
	} else if ((this.startTime + 1) > now) {	// we're still in "spin-up"
		// bufferTime = 1/2 acceleration * t^2;  // acceleration = 1
		bufferTime = now-this.startTime;
		bufferTime = bufferTime * bufferTime;
		bufferTime = bufferTime / 2;
    } else {
    	if ( this.sourceNode && this.sourceNode.playbackState == this.sourceNode.FINISHED_STATE ) {
    		// source node is done playing - shut everything down!
	        this.sourceNode = null;
	        this.gainNode = null;
    		this.isPlaying = false;
    		if (this.onPlaybackEnd)
    			this.onPlaybackEnd();
    	}
		this.updateTime( now );
		bufferTime = this.lastBufferTime;
	}
	var degrees = ( bufferTime / 60 * 33 * 360) % 360;
	var text = "rotate(" + degrees + "deg)";
	this.platter.style.webkitTransform = text;
	return this.isPlaying;	// "keep animating" - may need to check if !isplaying
}

Track.prototype.changePlaybackRate = function( rate ) {	// rate may be negative
	this.pbrText.innerText = parseFloat(rate).toFixed(2);
    if (!this.isPlaying) {
    	this.currentPlaybackRate = rate;
    	return;
	}
    var now = audioContext.currentTime;

    if (this.lastTimeStamp > now)
    	return; 	// TODO: for now, we don't deal with changing pbr before the
    // initial "spin-up" is complete.

    // update the position we're at in the buffer
    this.lastBufferTime += (now-this.lastTimeStamp) * this.lastPBR;
    this.lastPBR = rate;
    this.lastTimeStamp = now;

    if (this.lastBufferTime > this.buffer.duration) {	// we've run off the end
	    this.sourceNode = null;
		this.gainNode = null;
		this.lastPBR = this.buffer.duration;
		if (rate >=0)
			return;
		else
			this.lastBufferTime = this.buffer.duration;
    }
    if (this.lastBufferTime < 0) {	// we've run backwards over the beginning
	    this.sourceNode = null;
		this.gainNode = null;
		this.lastPBR = 0;
		if (rate <= 0)
			return;
		else
			this.lastBufferTime = 0;
    }
    if ( rate == 0.0 ) {
    	// stop playing and null the sourceNode
    	if (this.sourceNode) {
    		this.gainNode.gain.setTargetValueAtTime( 0, now, 0.01 );
    		this.sourceNode.noteOff(now + 0.1);
    		this.sourceNode = null;
    		this.gainNode = null;
    	}
    	return;
    }
    // if the rate isn't zero, we know we'll need a source node.
    // if the old value and the new value are on the same side
    // of zero, we can just set the rate, but otherwise we'll
    // need to stop the node and re-create it.  We may already 
    // be stopped, with no sourceNode.
    if ( this.sourceNode ) {
	    if (((this.currentPlaybackRate > 0) && (rate < 0)) ||
	    	((this.currentPlaybackRate < 0) && (rate > 0))	) {
	    	if (this.sourceNode) {
				this.gainNode.gain.setTargetValueAtTime( 0, now, FADE );
				this.sourceNode.noteOff(now + FADE*4);
				this.sourceNode = null;
				this.gainNode = null;
	    	}
	    }
	}

    // so... we may have just killed the sourceNode to flip, or 
    // we may have been stopped before.  Create the sourceNode,
    // pointing to the correct direction buffer.
	if (!this.sourceNode) {
	    var sourceNode = audioContext.createBufferSource();
	    sourceNode.loop = false;
		this.gainNode = audioContext.createGainNode();
		this.gainNode.connect( this.filter );
	    sourceNode.connect( this.gainNode );
	    sourceNode.buffer = (rate>0) ? this.buffer : this.revBuffer;
	    var startTime = (rate>0) ? this.lastBufferTime : sourceNode.buffer.duration-this.lastBufferTime;
	    
    	sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );
//    	this.gainNode.gain.setValueAtTime( 0, now );
//   		this.gainNode.gain.setTargetValueAtTime( this.gain, now+0.01, 0.01 );
    	var duration = ( this.cuePointIsActive && this.cuePointEnd ) ? 
    		(this.cuePointEnd - startTime) : (sourceNode.buffer.duration - startTime);
        this.gainNode.gain.value = 0.0;
        this.gainNode.gain.setTargetValueAtTime( this.gain, now, FADE );
    	sourceNode.noteGrainOn( now, startTime, duration );
	    this.sourceNode = sourceNode;
	} else
	    this.sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );
    this.currentPlaybackRate = rate;
}

Track.prototype.changeGain = function( gain ) {
	gain = parseFloat(gain).toFixed(2);
	this.gain = gain;
	if (this.gainNode)
		this.gainNode.gain.value = gain;
	this.gainText.innerText = gain;
}

var rafID = null;
var tracks = null;

function updatePlatters( time ) {
	if (!tracks)
		tracks = document.getElementById( "trackContainer" );

	var track;
	var keepAnimating = false;

	for (var i=0; i<tracks.children.length; i++)
		keepAnimating |= tracks.children[i].track.updatePlatter();

	if (keepAnimating)
		rafID = window.webkitRequestAnimationFrame( updatePlatters );
}
