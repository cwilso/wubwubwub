function Track( url ) {
	var thisTrack = this;
	var e = document.createElement( "div" );
	e.className = "track loading";
	var nameElement = document.createElement("span");
	nameElement.class="name";
	nameElement.appendChild( document.createTextNode(url) );
	e.appendChild( nameElement );
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
		    	thisTrack.revBuffer = thisTrack.reverseBuffer( buffer );
		    	thisTrack.trackElement.classList.remove( "loading" );
	  		}, function(){alert("error loading!");} ); 

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(ev.dataTransfer.files[0]);
	  	return false;
	};	

	this.loadNewTrack( url );
}

Track.prototype.reverseBuffer = function( buffer ) {
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
	    	track.revBuffer = track.reverseBuffer( buffer );
	    	track.trackElement.classList.remove( "loading" );
		} );
	}
	request.send();
}

Track.prototype.togglePlayback = function() {
    var now = audioContext.currentTime;

    if (this.isPlaying) {
        //stop playing and return
        if (this.sourceNode) {  // we may not have a sourceNode, if our PBR is zero.
	        var playback = this.sourceNode.playbackRate;
	        playback.cancelScheduledValues( now );
	        playback.setValueAtTime( playback.value, now );
	        playback.setTargetValueAtTime( 0.001, now+0.001, .3 );
	        this.gainNode.gain.setTargetValueAtTime( 0, now+1, 0.01 );
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
    sourceNode.playbackRate.linearRampToValueAtTime( 1.0, now+1 );
    this.currentPlaybackRate = 1.0;

	this.gainNode = audioContext.createGainNode();
	this.gainNode.connect( audioContext.destination );
    sourceNode.connect( this.gainNode );

    sourceNode.noteOn( now );
    this.sourceNode = sourceNode;
    this.isPlaying = true;
    this.lastTimeStamp = now + 0.5;		// the 0.5 is to make up for the initial "spin-up" ramp.
    this.lastBufferTime = 0;
    this.lastPBR = 1.0;
    return "stop";
}

Track.prototype.changePlaybackRate = function( rate ) {	// rate may be negative
    if (!this.isPlaying)
        return;

    var now = audioContext.currentTime;

    if (this.lastTimeStamp > now)
    	return; 	// TODO: for now, we don't deal with changing pbr before the
    // initial "spin-up" is complete.

    // update the position we're at in the buffer, and 
    this.lastBufferTime += (now-this.lastTimeStamp) * this.lastPBR;
    // TODO: this doesn't yet handle running off the ends of the buffer (before or after)
    this.lastPBR = rate;
    this.lastTimeStamp = now;

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
				this.gainNode.gain.setTargetValueAtTime( 0, now, 0.01 );
				this.sourceNode.noteOff(now + 0.1);
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
		this.gainNode.connect( audioContext.destination );
	    sourceNode.connect( this.gainNode );
	    sourceNode.buffer = (rate>0) ? this.buffer : this.revBuffer;
	    var startTime = (rate>0) ? this.lastBufferTime : sourceNode.buffer.duration-this.lastBufferTime;
	    
    	sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );
    	this.gainNode.gain.setValueAtTime( 0, now );
   		this.gainNode.gain.setTargetValueAtTime( 1, now+0.01, 0.01 );
 
    	sourceNode.noteGrainOn( now, startTime, sourceNode.buffer.duration - startTime );
	    this.sourceNode = sourceNode;
	} else
	    this.sourceNode.playbackRate.setValueAtTime( Math.abs(rate), now );
    this.currentPlaybackRate = rate;
}


