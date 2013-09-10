var audioCtx = null;

var leftTrack=null;
var rightTrack=null;
var FADE=0.01;
var REVPERSEC = 33.3 / 60.0;
var masterGain = null;
var runningDisplayContext = null;

// The Track object represents an in-memory track.  In order to be able to
// reverse the playback, it also creates and keeps a reversed version of
// the track in memory.
//
// This object does not currently handle running off the ends of the buffer
// (forward or backward) very gracefully.  //TODO.
function Track( url, left ) {
	var thisTrack = this;
	var e = document.createElement( "div" );
	e.track = thisTrack;
	e.className = "track loading";
	thisTrack.isLeftTrack = left;

	// It is important that this element be the first child!
	// when we load a new file, it changes child[0].
	var nameElement = document.createElement("div");
	nameElement.className="name";
	var name = url.slice( url.lastIndexOf("/") + 1 );
	var dot = name.lastIndexOf(".");
	if (dot != -1)
		name = name.slice( 0, dot );
	nameElement.appendChild( document.createTextNode(name) );
	this.nameElement = nameElement;
	e.appendChild( nameElement );

	var cueButton = document.createElement( "div" );
	cueButton.className = "cueButton";
	cueButton.appendChild( document.createTextNode("CUE") );
	cueButton.onclick=cue;
	e.appendChild( cueButton );

	var powerButton = document.createElement("div");
	powerButton.className = "powerButton";

	var powerImg = document.createElement("img");
	powerImg.src = "img/power.png";
	powerButton.appendChild( powerImg );
	powerButton.onclick=function(e) { 
		if (this.parentNode.track) {
			if ( this.parentNode.track.togglePlaybackSpinUpDown() )
				this.classList.add("active");
			  else
			  	this.classList.remove("active");
		}
	};
	e.appendChild( powerButton );

	var bufferdrawer = document.createElement("div");
	bufferdrawer.className = "audiobuffer";
	bufferdrawer.onclick = function ( ev ) {
		this.parentNode.track.jumpToPoint(ev.offsetX / 370.0 * this.parentNode.track.buffer.duration);
	}

	var canvas = document.createElement("canvas");
	canvas.width = "370";
	canvas.height = "50";
	this.bufferCanvas = canvas;
//	bufferdrawer.appendChild(canvas);

	canvas = document.createElement("canvas");
	canvas.width = "370";
	canvas.height = "50";
	canvas.style.zIndex = "100";
	this.trackDisplayCanvas = canvas;
	bufferdrawer.appendChild(canvas);

	e.appendChild( bufferdrawer );

	var deck = document.createElement( "div" );
	deck.className = "deck";
	var disc = document.createElement( "div" );
	disc.className = "disc";

	var platter = document.createElement( "canvas" );
	platter.className = "platter";
	this.platter = platter;
	this.platterContext = platter.getContext("2d");
	this.platterContext.fillStyle = "white";
	platter.width = 300;
	platter.height = 300;
	this.platterContext.translate(150,150);
	this.platterContext.font = "22px 'Chango', sans-serif";

	disc.appendChild( platter );
	deck.appendChild( disc );
	e.appendChild( deck );

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

	document.getElementById( "trackContainer" ).appendChild(e);
	this.trackElement = e;

  	e.addEventListener('dragover', function (evt) {
	    evt.stopPropagation();
	    evt.preventDefault();
	    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  	}, false);

	e.addEventListener('dragenter', function () { 
		e.classList.add("droptarget"); 
		return false; 
	}, false );
	e.addEventListener('dragleave', function () { 
		e.classList.remove("droptarget"); 
		return false; 
	}, false );

  	e.addEventListener('drop', function (ev) {
  		ev.preventDefault();
		e.classList.remove("droptarget");
  		e.firstChild.innerHTML = ev.dataTransfer.files[0].name;
  		e.classList.add("loading");

	  	var reader = new FileReader();
	  	reader.onload = function (event) {
	  		audioCtx.decodeAudioData( event.target.result, function(buffer) {
				if (thisTrack.isPlaying)
					thisTrack.togglePlayback();

				thisTrack.buffer = buffer;
				thisTrack.postLoadTasks();
	  		}, function(){alert("error loading!");} ); 

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(ev.dataTransfer.files[0]);
	  	return false;
	}, false );	

	this.gain = 1.0;
	this.gainSlider = gainSlider;
	this.pbrSlider = pbrSlider;
	this.currentPlaybackRate = 1.0;
    this.lastBufferTime = 0.0;
	this.isPlaying = false;
	this.loadNewTrack( url );
	this.xfadeGain = audioCtx.createGain();
	this.xfadeGain.gain.value = 0.5;
	this.xfadeGain.connect(masterGain);

	this.low = audioCtx.createBiquadFilter();
	this.low.type = "lowshelf";
	this.low.frequency.value = 320.0;
	this.low.gain.value = 0.0;
	this.low.connect( this.xfadeGain );

	this.mid = audioCtx.createBiquadFilter();
	this.mid.type = "peaking";
	this.mid.frequency.value = 1000.0;
	this.mid.Q.value = 0.5;
	this.mid.gain.value = 0.0;
	this.mid.connect( this.low );

	this.high = audioCtx.createBiquadFilter();
	this.high.type = "highshelf";
	this.high.frequency.value = 3200.0;
	this.high.gain.value = 0.0;
	this.high.connect( this.mid );

	this.filter = audioCtx.createBiquadFilter();
	this.filter.frequency.value = 20000.0;
	this.filter.type = this.filter.LOWPASS;
	this.filter.connect( this.high );
	this.cues = [ null, null, null, null ];
	this.cueButton = cueButton;
	this.cueDeleteMode = false;
}

function reverseBuffer( buffer ) {
	var newBuffer = audioCtx.createBuffer( buffer.numberOfChannels, buffer.length, buffer.sampleRate );
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

Track.prototype.postLoadTasks = function() {
	this.revBuffer = reverseBuffer( this.buffer );
	this.trackElement.classList.remove( "loading" );
	this.lastBufferTime = 0.0;
	for (var i=0; i<4; i++)
		this.cues[i] = null;
	// TODO: need to clear MIDI cue lights

	drawBuffer( this.bufferCanvas.width, this.bufferCanvas.height, 
		this.bufferCanvas.getContext('2d'), this.buffer ); 
	this.nameElement.innerHTML += " (" + this.buffer.duration.toFixed(1) + " sec)";

	this.waveformDisplayCache = createRunningDisplayCache( this.buffer, this.isLeftTrack );
	drawRunningDisplay( runningDisplayContext, this.waveformDisplayCache, this.lastBufferTime ); 

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
	  audioCtx.decodeAudioData( request.response, function(buffer) { 
	    	track.buffer = buffer;
	    	track.postLoadTasks();
		} );
	}
	request.send();
}

Track.prototype.setCuePointAtCurrentTime = function(index) {
	// save the current time
	this.updatePlatter( false );
	this.cues[index] = new Cue(this.lastBufferTime);
	if (index==0)
		this.cueButton.classList.add("active");
	
	return this.cues[index];
}

Track.prototype.clearCuePoint = function( index ) {
	this.cues[index] = null;
	if (index==0)
		this.cueButton.classList.remove("active");
}

Track.prototype.jumpToCuePoint = function( index ) {
	if (this.isPlaying)
		this.togglePlayback();

	this.lastBufferTime = this.cues[index].time;
	this.togglePlayback();
}

Track.prototype.jumpToPoint = function( time ) {
	var wasPlaying = this.isPlaying;
	if (wasPlaying)
		this.togglePlayback();
	this.lastBufferTime = time;
	if (wasPlaying)
		this.togglePlayback();
}

// play a short snippet of sound
Track.prototype.playSnippet = function() {
	var now = audioCtx.currentTime;
	var snippetLength = 11.0/360.0;
	var then = now + snippetLength;	// one tick
    var sourceNode = audioCtx.createBufferSource();
	var gainNode = audioCtx.createGain();

    sourceNode.loop = false;
	gainNode.connect( this.filter );
    sourceNode.connect( gainNode );
    sourceNode.buffer = (this.currentPlaybackRate>0) ? this.buffer : this.revBuffer;
    var startTime = (this.currentPlaybackRate>0) ? this.lastBufferTime : sourceNode.buffer.duration-this.lastBufferTime;
    
    // for now, let's try full playback rate
	// sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );

	// fade the sound in and out to avoid "clicking"
    gainNode.gain.setValueAtTime( 0.0, now );
    gainNode.gain.setTargetAtTime( this.gain, now, FADE );
    gainNode.gain.setTargetAtTime( 0.0, then, FADE );

	sourceNode.track = this;
	sourceNode.onended = shutDownNodeWhenDonePlaying.bind(sourceNode);
	sourceNode.start( now, startTime, sourceNode.buffer.duration - startTime );
	sourceNode.stop( then+snippetLength );
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
	  	this.playSnippet();
	  }
}

function shutDownNodeWhenDonePlaying() {
	if (this.track) {
		this.track.sourceNode = null;
	    this.track.gainNode = null;
		this.track.isPlaying = false;
	}
	if (this.onPlaybackEnd)
		this.onPlaybackEnd();
}

Track.prototype.togglePlaybackSpinUpDown = function() {
    var now = audioCtx.currentTime;

//	this.cuePointIsActive = false;

    if (this.isPlaying) {
        //stop playing and return
        if (this.sourceNode) {  // we may not have a sourceNode, if our PBR is zero.
	        var playback = this.sourceNode.playbackRate;
	        playback.cancelScheduledValues( now );
	        playback.setValueAtTime( playback.value, now );
	        playback.linearRampToValueAtTime( 0.001, now+1 );
	        this.gainNode.gain.setTargetAtTime( 0, now+1, 0.01 );
	        this.stopTime = now;
 		   	this.sourceNode.stop( now + 2 );
	        this.sourceNode = null;
	        this.gainNode = null;
        }
        this.isPlaying = false;
        return false;
    }

    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = this.buffer;
    sourceNode.loop = false;
    // The "now" below causes issues in FFnightly
    sourceNode.playbackRate.setValueAtTime( 0.001, now );
    sourceNode.playbackRate.linearRampToValueAtTime( this.currentPlaybackRate, now+1 );

	this.gainNode = audioCtx.createGain();
	this.gainNode.connect( this.filter );
	this.gainNode.gain.value = this.gain;
    sourceNode.connect( this.gainNode );

    this.sourceNode = sourceNode;
    this.isPlaying = true;
    this.lastTimeStamp = now + 0.5;		// the 0.5 is to make up for the initial 1s "spin-up" ramp.
    this.offset = this.lastBufferTime;
    this.restartTime = now;
    this.stopTime = 0.0;
    this.lastPBR = this.currentPlaybackRate;

    sourceNode.onended = shutDownNodeWhenDonePlaying.bind(this);
    sourceNode.start( now, this.lastBufferTime );

    return true;
}

Track.prototype.togglePlayback = function() {
    var now = audioCtx.currentTime;

    if (this.isPlaying) {
        //stop playing and return
        if (this.sourceNode) {  // we may not have a sourceNode, if our PBR is zero.
        	this.sourceNode.track = null;
	        this.stopTime = 0;
		    this.gainNode.gain.setTargetAtTime( 0.0, now, FADE );
 		   	this.sourceNode.stop( now + FADE*4 );
 	        this.sourceNode = null;
	        this.gainNode = null;
        }
        this.isPlaying = false;
        return "play";
    }

    this.isPlaying = true;
    this.lastTimeStamp = now;
    this.restartTime = now-1;	// skips our "spin-up" animation
    this.offset = this.lastBufferTime;
    this.stopTime = 0;
    this.lastPBR = this.currentPlaybackRate;

    this.changePlaybackRate(this.lastPBR);
    return "stop";
}

Track.prototype.updateTime = function( now ) {
//	console.log("updateTime: " + now + ", " + this.lastBufferTime)
    // update the position we're at in the buffer
    this.lastBufferTime += (now-this.lastTimeStamp) * this.lastPBR;
    this.lastTimeStamp = now;
}

var cueColors = ["red", "blue", "green", "yellow"];
var cueText = ["cue", "1", "2", "3"];

Track.prototype.updatePlatter = function( drawOnScreen ) {
    var now = audioCtx.currentTime;
    var bufferTime;
    var keepAnimating = this.isPlaying;

	if (!this.isPlaying) {
		if (this.stopTime) {	// still in spin-down; 
			if (now > (this.stopTime + 1) ) {	// done spinning down.
				this.lastBufferTime = this.lastBufferTime + 0.5;
				this.stopTime = 0;
				return false;
			} else {
				// bufferTime = 1/2 acceleration * t^2;  // keeping acceleration = 1 simplifies this!!
				bufferTime = 1 - (now-this.stopTime);
				bufferTime = bufferTime * bufferTime;
				bufferTime = bufferTime / 2;
				bufferTime = 0.5 - bufferTime + this.lastBufferTime;
				keepAnimating = true;
//				console.log( "now:" + now + " stopTime:" + this.stopTime + " bufferTime:" + bufferTime + " this.lastBufferTime:" + this.lastBufferTime );
			}
		} else
			bufferTime = this.lastBufferTime;
	} else if ((this.restartTime + 1) > now) {	// we're still in "spin-up"
		// bufferTime = 1/2 acceleration * t^2;  // acceleration = 1
		bufferTime = now-this.restartTime;
		bufferTime = bufferTime * bufferTime;
		bufferTime = bufferTime / 2;
		bufferTime += this.offset;
    } else {
		this.updateTime( now );
		bufferTime = this.lastBufferTime;
	}

	if (drawOnScreen) {
		var radians = ((bufferTime * REVPERSEC) % 1) * 2 * Math.PI;
		var context = this.platterContext;

		context.clearRect(-150,-150,300,300);  // TODO: shouldn't hardcode

      	context.rotate( radians );
		context.fillStyle = "white";
		context.fillText("wubwubwub",-61,8);
      	context.rotate( -radians );

		if (this.buffer) {
			// Now draw the position in the buffer

			var w = this.trackDisplayCanvas.width;
			var h = this.trackDisplayCanvas.height;
			var ctx = this.trackDisplayCanvas.getContext('2d');
			ctx.clearRect(0,0,w,h);
		    ctx.drawImage( this.bufferCanvas, 0, 0 );
			var boxWidth = w * bufferTime / this.buffer.duration;
			ctx.fillStyle = "rgba(255,255,255,0.33)";
			ctx.fillRect(0,0,boxWidth,h);

			for (var i=0; i<4; i++) {
				var cue = this.cues[i]; 
				if (cue ) {
					var x = cue.time / this.buffer.duration * w; 
					ctx.fillStyle = cueColors[i];
					ctx.fillRect( x, 0, 1, h );
					ctx.font = "12px bold Skia, Arial, sans-serif";
					ctx.fillText( cueText[i], x+2, h/4 );
				}
			}

			drawRunningDisplay( runningDisplayContext, this.waveformDisplayCache, bufferTime ); 

		    // draw the center bar
		    var isTop = this.isLeftTrack;
		    ctx = runningDisplayContext;
		    runningDisplayContext.fillStyle = "gray";
		    runningDisplayContext.fillRect(RUNNING_DISPLAY_HALF_WIDTH,isTop?0:RUNNING_DISPLAY_HALF_HEIGHT,1,RUNNING_DISPLAY_HALF_HEIGHT);

			// draw cues on the running display
			var begin = bufferTime - (SECONDS_OF_RUNNING_DISPLAY/2);
			var end = begin + SECONDS_OF_RUNNING_DISPLAY;
			for (var i=0; i<4; i++) {
				var cue = this.cues[i]; 
				if (cue && (cue.time>begin) && (cue.time<end)) {
					var x = (cue.time-begin) * RUNNING_DISPLAY_WIDTH / SECONDS_OF_RUNNING_DISPLAY; 
					ctx.fillStyle = cueColors[i];
					ctx.fillRect( x, isTop ? 0 : RUNNING_DISPLAY_HALF_HEIGHT, 1, RUNNING_DISPLAY_HALF_HEIGHT );
					ctx.font = "12px bold Skia, Arial, sans-serif";
					ctx.fillText( cueText[i], x+2, isTop ? RUNNING_DISPLAY_HALF_HEIGHT/2 : RUNNING_DISPLAY_HALF_HEIGHT*1.5 );
				}
			}

		}
	}

	return keepAnimating;	// "keep animating" - may need to check if !isplaying
}

Track.prototype.changePlaybackRate = function( rate ) {	// rate may be negative
	this.pbrText.innerHTML = parseFloat(rate).toFixed(2);
    if (!this.isPlaying) {
    	this.currentPlaybackRate = rate;
    	return;
	}
    var now = audioCtx.currentTime;

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
    		this.gainNode.gain.setTargetAtTime( 0, now, 0.01 );
    		this.sourceNode.stop(now + 0.1);
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
				this.gainNode.gain.setTargetAtTime( 0, now, FADE );
				this.sourceNode.stop(now + FADE*4);
				this.sourceNode = null;
				this.gainNode = null;
	    	}
	    }
	}

    // so... we may have just killed the sourceNode to flip, or 
    // we may have been stopped before.  Create the sourceNode,
    // pointing to the correct direction buffer.
	if (!this.sourceNode) {
	    var sourceNode = audioCtx.createBufferSource();
	    sourceNode.loop = false;
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = this.gain;
		this.gainNode.connect( this.filter );
	    sourceNode.connect( this.gainNode );
	    sourceNode.buffer = (rate>0) ? this.buffer : this.revBuffer;
	    var startTime = (rate>0) ? this.lastBufferTime : sourceNode.buffer.duration-this.lastBufferTime;
	    
    	sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );
    	var duration = (sourceNode.buffer.duration - startTime);
        this.gainNode.gain.value = 0.0;
        this.gainNode.gain.setTargetAtTime( this.gain, now, FADE );
		sourceNode.onended = shutDownNodeWhenDonePlaying.bind(sourceNode);
        sourceNode.start( now, startTime, duration );
	    this.sourceNode = sourceNode;
	} else  // if I replace "now" with "0" below, Firefox works.
	    this.sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );
    this.currentPlaybackRate = rate;
}

Track.prototype.changeGain = function( gain ) {
	gain = parseFloat(gain).toFixed(2);
	this.gain = gain;
	if (this.gainNode) {
		this.gainNode.gain.cancelScheduledValues( 0 );
		this.gainNode.gain.value = gain;
		this.gainNode.gain.setValueAtTime(gain,0);
	}
	this.gainText.innerHTML = gain;
}
