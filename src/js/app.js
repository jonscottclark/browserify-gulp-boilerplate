var $         = require('jquery');
var fastclick = require('fastclick');
var $script   = require('scriptjs');

// Config
var basePath = '/js/';

// https://www.npmjs.com/package/fastclick
fastclick(document.body);

// https://github.com/paulirish/matchMedia.js/
if (!Modernizr.mq('only all')) {
  $script(basePath + 'vendor/matchMedia.js');
}

// Namespace for our components
window.component = {};

$(function() {

  // Load component scripts
  var components = {
    'Nav': [],
    'Hero': []
  };

  $.each(components, function(comp, dep) {
    if ($('.'+comp).length) {
      var deps = [basePath + 'components/'+comp+'.js'];

      if (dep.length) {
        $.each(dep, function() {
          deps.push(basePath + dep);
        });
      }
      $script(deps, comp);

      $script.ready(comp, function() {
        component[comp].init();
      });
    }
  });
});
