function drawBuffer( width, height, context, buffer, color ) {
    var data = buffer.getChannelData( 0 );
    var step = Math.floor( data.length / width );
    var amp = height / 2;

    context.clearRect(0,0,width,height);
    if (color)
        context.fillStyle = color;
    for(var i=0; i < width; i++){
        var min = 1.0;
        var max = -1.0;
        for (j=0; j<step; j++) {
            var datum = data[(i*step)+j]; 
            if (datum < min)
                min = datum;
            if (datum > max)
                max = datum;
        }
        context.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
    }
}

var RUNNING_DISPLAY_WIDTH = 860;
var RUNNING_DISPLAY_HALF_WIDTH = RUNNING_DISPLAY_WIDTH/2;
var RUNNING_DISPLAY_HEIGHT = 80;
var SECONDS_OF_RUNNING_DISPLAY = 2.0;

function drawRunningDisplay( context, data, centerInSeconds, color, top ) {
    var center = Math.floor( centerInSeconds * RUNNING_DISPLAY_WIDTH / SECONDS_OF_RUNNING_DISPLAY );

    context.clearRect(0,0,RUNNING_DISPLAY_WIDTH,RUNNING_DISPLAY_HEIGHT);

    // draw the center bar
    context.fillStyle = "gray";
    context.fillRect(RUNNING_DISPLAY_HALF_WIDTH,0,1,RUNNING_DISPLAY_HEIGHT);

    // set the color for the waveform display
    context.fillStyle = color;

    for(var i=0; i < RUNNING_DISPLAY_WIDTH; i++){
        var data_idx = center - RUNNING_DISPLAY_HALF_WIDTH + i;
        if ((data_idx >=0)&&(data_idx<data.length)) {
            if (top)
                context.fillRect(i,0,1,data[data_idx]);
              else
                context.fillRect(i,RUNNING_DISPLAY_HEIGHT,1,-data[data_idx]);
        }
    }
}

function createRunningDisplayBuffer( context, buffer ) {
    var step = SECONDS_OF_RUNNING_DISPLAY * buffer.sampleRate / RUNNING_DISPLAY_WIDTH;
    var newLength = Math.floor( buffer.duration / SECONDS_OF_RUNNING_DISPLAY * RUNNING_DISPLAY_WIDTH );
    var data = buffer.getChannelData(0);

    var newData = new Float32Array( newLength );

    for (var i=0; i<newLength; i++) {
        var max = 0.0;
        var offset = Math.floor(i*step);
        for (var j=0; j<step; j++) {
            var datum = data[offset+j];
            if (datum < 0)
                datum = -datum;
            if (datum > max)
                max = datum;
        }
        newData[i] = Math.floor( max * RUNNING_DISPLAY_HEIGHT / 2 );
    }
    return newData;
}

// drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffer ); 
