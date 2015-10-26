var $         = require('jquery');
var fastclick = require('fastclick');
var $script   = require('scriptjs');

// Config
var basePath = '/js/';

// https://www.npmjs.com/package/fastclick
fastclick(document.body);

// https://github.com/paulirish/matchMedia.js/
if (!Modernizr.mq('only all')) {
  $script(basePath + 'matchMedia.js');
}

// Namespace for our components
window.component = {};

// App logic
$(function() {
  if ($('.Nav').length) {
    $script([basePath + 'components/Nav.js'], 'Nav');

    $script.ready('Nav', function() {
      component.Nav.init();
    });
  }
});
