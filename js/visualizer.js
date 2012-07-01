// Visualizer stuff here
var analyser1;
var analyserCanvas1;

var rafID = null;

function cancelVisualizerUpdates() {
  window.webkitCancelAnimationFrame( rafID );
}

function updateAnalyser( analyserNode, drawContext ) {
    var SPACER_WIDTH = 3;
    var BAR_WIDTH = 1;
    var OFFSET = 100;
    var CUTOFF = 23;
    var CANVAS_WIDTH = 800;
    var CANVAS_HEIGHT = 120;
    var numBars = Math.round(CANVAS_WIDTH / SPACER_WIDTH);
    var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

    analyserNode.getByteFrequencyData(freqByteData); 

    drawContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawContext.fillStyle = '#F6D565';
    drawContext.lineCap = 'round';
    var multiplier = analyserNode.frequencyBinCount / numBars;

    // Draw rectangle for each frequency bin.
    for (var i = 0; i < numBars; ++i) {
        var magnitude = 0;
        var offset = Math.floor( i * multiplier );
        // gotta sum/average the block, or we miss narrow-bandwidth spikes
        for (var j = 0; j< multiplier; j++)
            magnitude += freqByteData[offset + j];
        magnitude = magnitude / multiplier;
        var magnitude2 = freqByteData[i * multiplier];
        drawContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
        drawContext.fillRect(i * SPACER_WIDTH, CANVAS_HEIGHT, BAR_WIDTH, -magnitude);
    }
}


function updateVisualizer(time) {
    updateAnalyser( analyser1, analyserCanvas1 );
    rafID = window.webkitRequestAnimationFrame( updateVisualizer );
}

var visualizerActive = false;
var visualizerNode = null;

function visualizeDrums(canvasElement) {
    if ( visualizerActive ) {
        cancelVisualizerUpdates();
        visualizerNode.noteOff(0);
        visualizerNode = null;
        analyser1 = null;
        analyserCanvas1 = null;
        visualizerActive = false;
        return "visualize!";
    }

    visualizerActive = true;
    visualizerNode = audioContext.createBufferSource();
    visualizerNode.buffer = drumsBuffer;
    visualizerNode.loop = true;

    analyser1 = audioContext.createAnalyser();
    analyser1.fftSize = 2048;
    analyser1.maxDecibels = 0;

    analyserCanvas1 = canvasElement.getContext('2d');
  
    visualizerNode.connect( audioContext.destination );
    visualizerNode.connect( analyser1 );

    visualizerNode.noteOn(0);
    updateVisualizer(0);
    return "stop!";
}

