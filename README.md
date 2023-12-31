# Modular Pink Trombone
A modular, audio-only version of Pink Trombone optimized for use in live performance. Features significantly faster and non-blocking audio processing and the ability to produce multiple simultaneous voices.

__This code is functional on Chrome and Firefox. Other browsers have not yet been tested.__

## Modifications from original
- The deprecated ```ScriptProcessorNode``` used in the original Pink Trombone code has been replaced with a new Web Audio API ```AudioWorkletNode```. This allows the audio processing to run in a dedicated thread, preventing the it from interfering with the rest of the script, or vice versa.
  - The Pink Trombone variables ```Tract``` and ```Glottis``` have been reimplemented as instance variables of a new Web Audio ```AudioWorkletProcessor``` child-class ```VocalWorkletProcessor```. This allows multiple AudioWorkletNode objects, each with its own processor, to run simultaneously. You can create a Pink Trombone chorus, if you so wish.
- The UI has been removed. Interfacing with the synthesizer is done solely by manipulating its variables directly (see usage info below). To allow fricatives (noisy sounds resulting from points of high constriction) to be created without mouse input, the vocal processor simulates "touch" using the ```constriction-index``` and ```constriction-diameter``` AudioParameters. See Usage below for more info.

## Installation
- ```git clone``` this repo into your project folder
- Add script tag to project html file: most likely ```<script src="Modular_Pink_Trombone/pink_trombone_script.js"></script>``` or...
- Incorporate the code from pink_trombone_script.js into your own Web Audio system. You'll still need to include ```pink_trombone_processor.js``` and ```noise.js```.

## Configuration
- Set the MAX number of Pink Trombone voices sounding simultaneously using the ```options.maxVoices``` property inside ```pink_trombone_script.js```
  - This number will depend on your CPU strength, so test it beforehand. If set too high there will be audible popping in the outputted sounds.
- Set the Vocal audio output destination by changing ```gainNode.connect(<destination>)``` towards the top of ```pinkTromboneVoicesInit()``` inside ```pink_trombone_script.js```.
  - The destination can be another Web Audio API audio node for further audio processing, or the voices can output to the computer's audio output device directly using ```voiceNode.connect(audioContext.destination)``` (this is the default).
- The audioContext is paused by default, and must be initiated by a user event, probably click. This is done by including ```pinkTromboneVoicesInit()``` in the callback of a mouseClick event.
  - ```<DOMElement>.addEventListener('click', pinkTromboneVoicesInit, {once: true})```
  - This event listener can be attached to any DOM element such as button, etc. It can also be attached to the window.

The Noise module, which creates smooth randomized signals to be applied to the voice (for vibrato purposes), has been made into a class so that each separate voice can have its own noise module. This allows each voice to have a different RNG seed, which will de-synchronize the vibratos. The seed is set in the ```VocalWorkletProcessor``` constructor in ```pink_trombone_processor.js```:
- Use ```this.noise.seed(Math.random())``` to set a random noise seed to de-synchronize the vibratos of the voices. This makes the multi-voice effect more realistic. This is the default.
- Use ```this.noise.seed(<anyConstant>)``` to set the seeds to the same (arbitrary) value, synchronizing the vibratos and detracting from the realism a bit.

## Usage
Creating speech involves real-time manipulation of a series of AudioParams, manipulation of the Tract diameter array and (optionally) adding a post-processing EQ to the voice.

### Audio + voice setup
- Call ```pinkTromboneVoicesInit()``` to initialize gain node, voice nodes and EQ filter nodes.
- Call ```setVoiceCount(<desired#ofVoices>)``` to set current # of outputting voices. Set it to only the number of voices you currently need to save CPU. Call this function at any point during runtime to increase the number of simultaneous voices needed. Make sure the number isn't above ```options.maxVoices```!
- Adjust voice volume using ```gainNode.gain.value = <valueBetween0and1>```

### VocalWorkletProcessor AudioParams
The new VocalWorkletProcessor includes 2 class variables, ```Tract``` and ```Glottis```, that perform the speech synthesis. Several key properties of these variables are adjusted in real-time using ```AudioParams``` to create speech and manipulate the timbral quality of the voice:
- ```frequency``` (in Hz): sets the fundamental pitch of the voice
  - It should be within the audible frequency range: >30Hz. Anything above ~400Hz starts to sound strained.
- ```vibrato-amount``` + ```vibrato-frequency``` (in Hz): set the frequency and magnitude of fluctuation of the pitch (vibrato)
  - Defaults are 0.005 and 6, respectively, mess around with them a bit to get the vibrato effect you want.
- ```tenseness``` (0-1): tension of the vocal cords - "breathiness"
- ```intensity``` (0-1): volume of air flow through the vocal tract. Doesn't exactly correspond to volume.
- ```loudness``` (0-1): volume of pitched component of voice.
  - This isn't the same as gain. Experiment with a combination of tenseness, intensity and loudness to get your desired volume and voice quality as it's a bit unpredictable. All 3 values are set to 0 by default, so increase them (especially loudness and intensity) to hear the voice.
- ```velum-target``` (in cm, recommended 0.01-0.4): sets the diameter of the velum, a passage of air between the oral and nasal tracts.
#### _*new AudioParams in modularPinkTrombone*_
- ```base-tenseness``` a multiplier of the tenseness parameter, used to scale down the tenseness of the voice. Set to 1 to remove this modifier.
- ```constriction-index``` and ```constriction-diameter```: used to simulate touch position when generating fricative noise (see below on getting these values).
- ```fIntensity``` (0-1): volume of generated fricative noise - white noise resulting from areas of high constriction.
  - Set to 1 for default volume
- ```tIntensity``` (0-1): volume of generated transients - clicks produced at the moment when the vocal tract opens after having been closed.
  - Default in Pink Trombone is 0.3

### Manipulating AudioParams
The properties listed above can be changed using the ```AudioParam``` instance methods listed [here](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam), or by setting their ```value``` property directly.
- Get an AudioWorklet AudioParam using ```<audioWorkletNode>.parameters.get("parameterName")```
The voices are added to a global array ```voices``` for esy access. Use voice array indexes to address individual voices.
- ex - to open the velum of the second voice:
  - ```voices[1].parameters.get('velum-target').value = .4;```
- ex - to set the frequencies of all voices to the same value:
  - ```for (let v of voices) v.parameters.get('frequency').value = 150;```

### Manipulating Tract diameters
The VocalWorkletProcessor Tract object contains 2 key properties related to diameters: ```diameter``` and ```targetDiameter```. These are both 44-length Float64Arrays representing the CURRENT and TARGET values, respectively, of the diameters of the vocal tract at 44 different points. Every frame, the values in diameter are interpolated smoothly towards those in targetDiameter. 

Since Tract diameter and targetDiameter are arrays, they cannot not be incorporated as AudioParams. Instead, the AudioWorkletProcessor object ```messagePort```  provides 2-way communication between the AudioWorkletNode and its processor. Send an object through the voice's messagePort with keys ```d``` or ```td``` to set diameters or targetDiameters, respectively, where the values are 44-length Float64Arrays of diameter values.

- To set the diameters of a voice smoothly, set only the targetDiameters:
  - ```voices[i].port.postMessage({td: <Float64Array>})```
- To set the diameters INSTANTLY:
  - ```voices[i].port.postMessage({td: <Float64Array>, d: <theSameFloat64Array>})```
  - targetDiameters and diameters must BOTH be set to set the values instantly and prevent them from returning to their previous values.
- To iterate through ```voices``` to set the diameters of ALL voices to have them speak together:
  - ```for (let v of voices) v.port.postMessage(...```
- or iterate through a custom set of voices to have them speak together but independently of other voices:
  - ```for (let i of [0, 2, 3, 5]) voices[i].port.postMessage(...```

### Adjusting voice EQ
Each AudioWorkletNode is passed through its own series of filters, designed to allow an EQ to be applied to the voice for further timbral control. 
- The cutoff frequencies and Q value of the filters is set in the ```filter``` variable inside ```pink_trombone_script.js```. They are set to 1/2-octave intervals and a Q value of 2.87 by default, but can be adjusted, added or removed as desired. The number of created filters is automatically tied to the length of the array.
- __The ```filter.f``` array MUST contain at least 1 integer to prevent errors. If you don't plan on using the EQ, include at least 1 arbitrary value in the array. The EQ filters are disabled by default.__
- The filters are created inside ```pinkTromboneVoicesInit()```. Once the function is called, the filters cannot be (easily) changed, added or removed.
- To adjust the strength of each filter, in dB, use the filter's ```gain``` property, or set it to 0 to disable the filter, allowing the voice to pass through unchanged. The gain values can be negative. The values are set to 0 by default, so no filter will be applied initially.
- An array of pointers to the filters of each voice are automatically set to the ```filters``` property of each AudioWorkletNode, to allow the filters of each voice to be addressed individually.
- To set the value of a single filter:
  - ```voices[i].filters[j].gain.value = 10```
- To map an array of gain values to all the filters of a single voice:
  - ```for (var j in gains) voices[i].filters[j].gain.value = gains[j]``` where ```gains``` is an array of floats of equal length to the number of filters (19 filters by default)
 
### Creating speech "animations"
You can animate the speaking of a word by creating an array of voice "frames", where each frame is an object with values for diameters, loudness, intensity, etc.
- ```const frames = [{d: <Float64Array>}, l: <loudness>, i: <intensity>, (add pairs for other audioParams)}, (repeat per animation frame)]``` - use whatever object keys you'd like
- To apply a frame to a voice:
  - ```voices[i].port.postMessage({d: frames[j].d, td: frames[j].d}); voices[i].parameters.get('loudness').value = frames[j].l; (repeat for other audioParams)```
#### Reording speech diameters
You can avoid hard-coding many values yourself by "recording" them from Pink Trombone over time. I'd recommend using the original Pink Trombone UI for this. In the developer tools console:
- ```let frames = []```
- ```setInterval(function() {frames.push({d: Tract.diameter, l: Glottis.loudness, v: Tract.noseDiameter[0], (repeat for other values to record)})}, 1000/60);```
  - You may choose to call the above line of code in the callback of a window ```keypress``` event.
- Say something using Pink Trombone UI
- Copy ```frames``` array. You may want to use ```JSON.stringify(frames)```
- Paste array into your own script. If you copied the object literal using ```JSON.stringify()``` you'll need to use ```JSON.parse(<literal>)``` to parse the string into the original object.
- Trim frames using ```frames.slice(<startFrame>, <endFrame>)```, reverse frames using ```frames.reverse()```, etc.

