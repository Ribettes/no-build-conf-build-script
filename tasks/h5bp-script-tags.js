
var path = require('path'),
  fs = require('fs'),
  jsdom = require('jsdom'),
  EventEmitter = require('events').EventEmitter,
  jquery = fs.readFileSync(path.join(__dirname, 'support', 'jquery.js'), 'utf8'),
  plugins = require('./processors/plugins/jquery.fs');

// https://github.com/h5bp/html5-boilerplate/issues/831

var regbuild = /^\s*<!--\s*\[\[\s*build\s(\w+)\s([\w\d\.\-_\/]+)\s*\]\]\s*-->/,
  regend = /\s*<!--\s*\[\[\s*endbuild\s*\]\]\s*-->/;

// Load processors
var processors = {};
fs.readdirSync(path.join(__dirname, 'processors')).forEach(function(file) {
  var filepath = path.resolve(__dirname, 'processors', file),
    filename = path.basename(file).replace(path.extname(file), '');

  if(!fs.statSync(filepath).isFile()) return;

  processors[filename] = require(filepath);
});

task('htmltags', 'Process html files', function(options, em) {
  invoke('mkdirs');
  gem.on('end:mkdirs', function() {
    var source = path.join(__dirname, '..', dir.intermediate),
      files = file.pages.default.include.split(', ').map(function(f) {
        return path.resolve(source, f);
      });

    files.forEach(processFile(em));
  });
});

function processFile(em) { return function (file) {
  if(!path.existsSync(file)) return;

  var body = fs.readFileSync(file, 'utf8'),
    sections = parse(body);

  var bundles = Object.keys(sections),
    ln = bundles.length,
    // todo: working with a single file, since this is wrapped
    // in a forEach files, the end event will be triggered for each
    // one
    next = function(err, html, replacement) {
      if(err) return em.emit('error', err);

      em.emit('log', 'Processor done, replacing with ' + replacement);
      body = body.replace(html, replacement);
      if(--ln) return;

      em.emit('log', 'Update ' + file + ' with processed assets.');
      // Write the new body on latest execustion call
      fs.writeFileSync(file, body, 'utf8');
      em.emit('end');
    };


  bundles.forEach(function(bundle) {
    var parts = bundle.split(':'),
      processor = processors[parts[0]],
      content = sections[bundle].join('\n');

    em.emit('log', 'Processing bundle: ' + parts[1] + ' with ' + parts[0] + ' processor ');

    // Processors are the files in processors/, a [[ build processor filename.ext ]] directive
    // directly drives which processors handle the replacement.
    if(!processor) return em.emit('error', new Error('Unkown processor: ' + parts[0]));

    // bootstrap a jsdom env for each files, done in // for now
    // may ends up doing it sequentially if needed
    jsdom.env({
      html: content,
      src: [jquery],
      done: function(err, window) {
        if(err) return em.emit('error', err);
        var $ = extend(window.$, em, plugins);
        // todo: clarify params here, processors should probably don't know
        // which html fragment is replaced.
        processor.call(em, $, parts[1], content, em, next);
      }
    });
  });

}}

function extend($, em, pmodule) {
  $.extend($.fn, pmodule($, em));
  return $;
}


function parse(body) {
  var lines = body.split('\n'),
    block = false,
    sections = {},
    last;

  lines.forEach(function(l) {
    var build = l.match(regbuild),
      endbuild = regend.test(l);

    if(build) {
      block = true;
      sections[[build[1], build[2]].join(':')] = last = [];
    }

    // switch back block flag when endbuild
    if(block && endbuild) {
      last.push(l);
      block = false;
    }

    if(block && last) {
      last.push(l);
    }
  });

  return sections;
}
