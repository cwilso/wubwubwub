function Track( url ) {
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
		} );
	}
	request.send();
}

Track.prototype.togglePlayback = function() {
    var now = audioContext.currentTime;

    if (this.isPlaying) {
        //stop playing and return
        var playback = this.sourceNode.playbackRate;
        playback.cancelScheduledValues( now );
        playback.setValueAtTime( playback.value, now );
        playback.setTargetValueAtTime( 0.001, now+0.001, .3 );
        this.sourceNode.noteOff( now + 2 );
        this.sourceNode = null;
        this.isPlaying = false;
        return "play";
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = this.buffer;
    sourceNode.loop = true;
    sourceNode.playbackRate.setValueAtTime( 0.001, now );
    sourceNode.playbackRate.setTargetValueAtTime( 1.0, now+0.001, .3 );
    this.currentPlaybackRate = 1.0;

    sourceNode.connect( audioContext.destination );

    sourceNode.noteOn( now );
    this.sourceNode = sourceNode;
    this.isPlaying = true;
    return "stop";
}

Track.prototype.changePlaybackRate = function( rate ) {	// rate may be negative
    if (!this.isPlaying)
        return;

    var now = audioContext.currentTime;

    if ( rate == 0.0 ) {
    	// stop playing and null the sourceNode
    	if (this.sourceNode) {
    		this.sourceNode.noteOff(0);
    		this.sourceNode = null;
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
	    		this.sourceNode.noteOff(0);
	    		this.sourceNode = null;
	    	}
	    }
	}

    // so... we may have just killed the sourceNode to flip, or 
    // we may have been stopped before.  Create the sourceNode,
    // pointing to the correct direction buffer.
	if (!this.sourceNode) {
	    var sourceNode = audioContext.createBufferSource();
	    sourceNode.buffer = (rate>0) ? this.buffer : this.revBuffer;
	    sourceNode.loop = true;
	    sourceNode.connect( audioContext.destination );
	    sourceNode.noteOn( now );
	    this.sourceNode = sourceNode;
	}
	var playback = this.sourceNode.playbackRate;
    playback.cancelScheduledValues( now );
    playback.setValueAtTime( playback.value, now );
    playback.setTargetValueAtTime( Math.abs( rate ), now+0.001, .001 );
    this.currentPlaybackRate = rate;
}

