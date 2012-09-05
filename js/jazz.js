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

