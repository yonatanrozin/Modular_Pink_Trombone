//set maximum allowed # of voices depending on CPU
export const options = {
    maxVoices: 5,
    filter: {
        f: JSON.parse(
            "[31, 44, 62, 88, 125, 176, 250, 353, 500, 707, 1000, 1414, 2000, 2828, 4000, 5656, 8000, 11313, 16000]"
        ),
        Q: 2.871
    }
};

export let ctxInitiated = false;

//an array to hold created voice nodes
export const voices = [];

/*
    Args: an audioContext and a destination node (will default to context.destination)
        Creates # of pink trombone voices according to options.maxVoices
        Creates filters for each individual voice according to options.filter
*/
export async function pinkTromboneVoicesInit(ctx, destination = ctx.destination) {
    await ctx.audioWorklet.addModule(
        "modular_pink_trombone/pink_trombone_processor.js"
    );
    if (!ctx instanceof AudioContext) throw new Error('invalid AudioContext.');
    if (!destination instanceof AudioNode) throw new Error('invalid destination.');

  /*
   *    Create voice nodes. For each:
   *        Set # inputs to 2, # outputs to 1
   *        Create a white noise node (looping random 2s waveform)
   *        Pass white noise through 2 filters in parallel
   *        Connect both filters to different inputs of the voice node
   *            Input 0 = aspiration noise, input 1 = fricative noise
   *        Create EQ filter nodes according to specified mode
   *        Connect voice source to filter nodes in series + output to destination
   */
  for (let v = 0; v < options.maxVoices; v++) {
    let voiceNode = new AudioWorkletNode(ctx, "voice", {
      numberOfInputs: 2, //one for aspiration noise, one for fricative noise
      numberOfOutputs: 1,
      outputChannelCount: [2], //stereo output for panning
      processorOptions: { voiceNum: v }
    });

    //see pinktrombone AudioSystem.init and AudioSystem.startSound
    let sampleRate = ctx.sampleRate;
    let buf = ctx.createBuffer(1, sampleRate * 2, sampleRate);
    let bufSamps = buf.getChannelData(0);
    for (let i = 0; i < sampleRate * 2; i++) {
      bufSamps[i] = Math.random();
    }
    let noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buf;
    noiseNode.loop = true;

    let aspirateFilter = ctx.createBiquadFilter();
    aspirateFilter.type = "bandpass";
    aspirateFilter.frequency.value = 500;
    aspirateFilter.Q.value = 0.5;
    noiseNode.connect(aspirateFilter);
    aspirateFilter.connect(voiceNode, 0, 0);

    let fricativeFilter = ctx.createBiquadFilter();
    fricativeFilter.type = "bandpass";
    fricativeFilter.frequency.value = 1000;
    fricativeFilter.Q.value = 0.5;
    noiseNode.connect(fricativeFilter);
    fricativeFilter.connect(voiceNode, 0, 1);
    noiseNode.start();

    let filterFreqs = options.filter.f;

    //create filter nodes according to # and value of frequencies
    voiceNode.filters = filterFreqs.map((f, i) => {
      let fType;
      if (i == 0) fType = "lowshelf";
      else if (i == filterFreqs.length - 1) fType = "highshelf";
      else fType = "peaking";

      let filterNode = new BiquadFilterNode(ctx);
      filterNode.type = fType;
      filterNode.frequency.value = f;
      filterNode.Q.value = options.filter.Q;
      filterNode.gain.value = 0;
      return filterNode;
    });

    //connect voice -> first filter -> all filters in series -> audio destination
    for (let i in voiceNode.filters) {
      if (i == 0) voiceNode.connect(voiceNode.filters[0]);
      if (i == voiceNode.filters.length - 1) {
        //create pointer to last filter (filtered voice output)
        voiceNode.outputNode = voiceNode.filters[i];
        voiceNode.outputNode.connect(destination);
      }
      if (i > 0) {
        voiceNode.filters[i - 1].connect(voiceNode.filters[i]);
      }
    }
    voices[v] = voiceNode; //add node to voices array
  }

  ctx.resume(); //resume in case paused by default
  console.log("audio context initiated.");
}