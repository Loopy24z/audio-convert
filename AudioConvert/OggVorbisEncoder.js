/**
 * OggVorbisEncoder.js — Web Worker OGG Vorbis Encoder
 * Menggunakan libvorbis.js (Emscripten asm.js) untuk encoding.
 *
 * Cara pakai dari main thread:
 *   const worker = new Worker('OggVorbisEncoder.js');
 *   worker.postMessage({ cmd: 'encode', sampleRate: 44100, channels: 2, quality: 0.4, buffers: [...] });
 *   worker.postMessage({ cmd: 'finish' });
 *   worker.onmessage = (e) => {
 *     if (e.data.cmd === 'done') { // e.data.blob = OGG Blob }
 *   };
 */

var module = {exports: {}};
var exports = module.exports;

importScripts('https://loopy24z.github.io/audio-convert/libvorbis.js');

var _lib = module.exports;
var _enc = null;
var _channels = 2;
var _chunks = [];

function encoderInit(sampleRate, channels, quality) {
  _channels = channels;
  _chunks = [];
  _enc = _lib._encoder_init(channels, sampleRate, quality);
  _lib._encoder_stream_init(_enc);
}

function encoderFeed(buffers) {
  var len = buffers[0].length;
  var ab = _lib._encoder_analysis_buffer(_enc, len) >> 2;
  for (var c = 0; c < _channels; c++) {
    _lib.HEAPF32.set(buffers[c], _lib.HEAPU32[ab + c] >> 2);
  }
  _encoderProcess(len);
}

function _encoderProcess(len) {
  _lib._encoder_process(_enc, len);
  var dlen = _lib._encoder_data_len(_enc);
  if (dlen > 0) {
    var d = _lib._encoder_transfer_data(_enc);
    _chunks.push(_lib.HEAPU8.slice(d, d + dlen));
  }
}

function encoderFinish() {
  _encoderProcess(0);
  var blob = new Blob(_chunks, {type: 'audio/ogg'});
  _lib._encoder_clear(_enc);
  _enc = null;
  _chunks = [];
  return blob;
}

self.onmessage = function(e) {
  var data = e.data;
  if (data.cmd === 'init') {
    encoderInit(data.sampleRate, data.channels, data.quality || 0.4);
    self.postMessage({cmd: 'ready'});
  } else if (data.cmd === 'encode') {
    if (!_enc) encoderInit(data.sampleRate || 44100, data.channels || 2, data.quality || 0.4);
    encoderFeed(data.buffers);
    self.postMessage({cmd: 'encoded'});
  } else if (data.cmd === 'finish') {
    var blob = encoderFinish();
    self.postMessage({cmd: 'done', blob: blob});
  }
};
