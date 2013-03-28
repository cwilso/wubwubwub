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

function drawWindowedBuffer( width, height, context, data, begin, end, color, top ) {
    var length = end - begin;
    var step = Math.floor( length / width );

    context.fillStyle = "gray";
    context.clearRect(0,0,width,height);
    context.fillRect(width/2,0,1,height);
    context.fillStyle = color;

    for(var i=0; i < width; i++){
        var max = 0.0;
        for (j=0; j<step; j++) {
            var data_idx = begin + (i*step)+j;
            if ((data_idx >=0)&&(data_idx<data.length)) {
                var datum = data[data_idx]; 
                if (datum > max)
                    max = datum;
            }
        }
        if (top)
            context.fillRect(i,0,1,(max)*height/2);
          else
            context.fillRect(i,height,1,-(max)*height/2);
    }
}

function div64Buffer( context, buffer ) {
    var data = buffer.getChannelData(0);
    var newLength = Math.floor( data.length / 64 );

    var newData = new Float32Array( newLength );

    for (var i=0; i<newLength; i++) {
        var max = 0.0;
        for (var j=0; j<64; j++) {
            var datum = data[(i*64)+j]; 
            if (datum < 0)
                datum = -datum;
            if (datum > max)
                max = datum;
        }
        newData[i] = max;
    }
    return newData;
}

// drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffer ); 
