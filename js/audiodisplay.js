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
var RUNNING_DISPLAY_HALF_HEIGHT = RUNNING_DISPLAY_HEIGHT/2;
var SECONDS_OF_RUNNING_DISPLAY = 2.0;

function drawRunningDisplay( context, cache, centerInSeconds ) {
    var center = Math.floor( centerInSeconds * RUNNING_DISPLAY_WIDTH / SECONDS_OF_RUNNING_DISPLAY );
//    var centerOffset = RUNNING_DISPLAY_HALF_WIDTH - center;
    var left = center - RUNNING_DISPLAY_HALF_WIDTH;

    var leftEdgeIndex = Math.floor((center - RUNNING_DISPLAY_HALF_WIDTH)/MAX_CANVAS_WIDTH);
    if (leftEdgeIndex<0)
        leftEdgeIndex=0;
    var rightEdgeIndex = Math.floor((center + RUNNING_DISPLAY_HALF_WIDTH)/MAX_CANVAS_WIDTH);
    if (rightEdgeIndex>=cache.length)
        rightEdgeIndex = cache.length - 1;

//    if (center!=0)
//        console.log("draw: " + leftEdgeIndex + ":" + rightEdgeIndex);
    for (var i = leftEdgeIndex; i<=rightEdgeIndex; i++) {
        context.drawImage( cache[i], RUNNING_DISPLAY_HALF_WIDTH - center + (MAX_CANVAS_WIDTH*i), 0 );
//        if (center!=0)
//            console.log("cache " + i + " offset " + (RUNNING_DISPLAY_HALF_WIDTH - center + (MAX_CANVAS_WIDTH*i)));
    }
}

var MAX_CANVAS_WIDTH = 32000;   // limitation - can't draw canvases wider than 32k

function createRunningDisplayCache( buffer, isTop ) {
    var step = SECONDS_OF_RUNNING_DISPLAY * buffer.sampleRate / RUNNING_DISPLAY_WIDTH;
    var newLength = Math.floor( buffer.duration / SECONDS_OF_RUNNING_DISPLAY * RUNNING_DISPLAY_WIDTH );
    var data = buffer.getChannelData(0);
    var numCanvases = Math.ceil( newLength / MAX_CANVAS_WIDTH );
    var canvases = [];

//    newLength = Math.min(newLength, 32000   );

    // draw the canvas
    for (var j=0; j<newLength; j+=MAX_CANVAS_WIDTH) {
        // create canvas with width of the reduced-in-size buffer's length.
        var canvas = document.createElement('canvas');
        var width = newLength - j;
        canvas.width = (width>MAX_CANVAS_WIDTH) ? MAX_CANVAS_WIDTH : width;
        canvas.height = RUNNING_DISPLAY_HEIGHT;  
        var drawCTX = canvas.getContext('2d');

        drawCTX.clearRect(0,0,newLength,RUNNING_DISPLAY_HEIGHT);
        // set the color for the waveform display
        drawCTX.fillStyle = isTop ? "blue" : "red";

        // draw the canvas
        for (var i=0; i<width; i++) {
            var max = 0.0;
            var offset = Math.floor((i+j)*step);
            for (var k=0; k<step; k++) {
                var datum = data[offset+k];
                if (datum < 0)
                    datum = -datum;
                if (datum > max)
                    max = datum;
            }
            max = Math.floor( max * RUNNING_DISPLAY_HEIGHT / 2 );
            if (isTop)
                drawCTX.fillRect(i,0,1,max);
              else
                drawCTX.fillRect(i,RUNNING_DISPLAY_HEIGHT,1,-max);
        }
        canvases.push( canvas );
    }
    return canvases;
}
