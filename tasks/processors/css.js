
// Run some jQuery on a html fragment
var jsdom = require('jsdom'),
  fs = require('fs'),
  path = require('path'),
  EventEmitter = require('events').EventEmitter,
  jquery = fs.readFileSync(path.join(__dirname, '..', 'support', 'jquery.js'), 'utf8'),
  plugins = require('./plugins/jquery.fs');

// API usage example
var processor = module.exports = function processor(file, content, output, em) {
  console.log('CSS processor: ', file);

  var filename = path.basename(file),
    dirname = path.dirname(file);

  // needs refactoring
  return processor.dom(filename, dirname, output, content, [jquery], em);
};

processor.dom = function dom(filename, basename, output, html, src, em) {
  var emitter = new EventEmitter();
  //  a match is a valid html fragment
  console.log('Paths are relative to ', basename);
  console.log('Loading dom environment for: ', filename);
  console.log(html);
  jsdom.env({
    html: html,
    src: src,
    done: function(errors, window) {
      var $ = extend(window.$, em, plugins);

      $('link[href]').md5('intermediate/' + output, function(err, hash, file) {
        if(err) return em.emit('error', err);
        em.emit('log', 'Rev concat css files ok ' + output + ' ' + hash);
        var href = output.split('/').slice(0, -1).concat(hash + '.' + path.basename(output)).join('/');
        return emitter.emit('end', html, '<link rel="stylesheet href="' + href + '">');
      });
    }

  });

  return emitter;
};

function extend($, em, pmodule) {
  $.extend($.fn, pmodule($, em));
  return $;
}
