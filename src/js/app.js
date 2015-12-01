import $ from 'jquery';
import fastclick from 'fastclick';
import $script from 'scriptjs';

// Config
let basePath = '../js/';

// https://www.npmjs.com/package/fastclick
fastclick(document.body);

// https://github.com/paulirish/matchMedia.js/
if (!Modernizr.mq('only all')) {
  $script(basePath + 'vendor/matchMedia.js');
}

// Breakpoints for media queries and element queries.
// Matches breakpoints defined in /src/css/utilities/_responsive.scss
window.breakpoint = {
  'tiny': '260',
  'xxsmall': '320',
  'xsmall': '480',
  'small': '640',
  'medium': '768',
  'large': '960'
};

// Namespace for our components
window.component = {};

// Global functions that we want exposed to other components
window.component.App = (function() {
  return {
    'test': function() {
      console.log('test');
    }
  };
})();

// Shortcut to global functions
window.$app = window.component.App;

// Component scripts
$(function() {
  // Load the following component scripts by key
  // Items in array are child components that must be loaded
  //   before the main component script
  let components = {
    'Nav': []
  };

  $.each(components, function(comp, deps) {
    if ($('.' + comp).length) {
      let scripts = [basePath + 'components/' + comp + '.js'];
      let init = [comp];

      if (deps.length) {
        $.each(deps, (i, d) => {
          if (d.substr(-3) !== '.js') {
            // Child component
            // 1. Complete path
            // 2. add to list of components to initialize
            scripts.push(basePath + 'components/' + d + '.js');
            init.push(d);
          } else {
            // Regular dependency with complete file path
            scripts.push(basePath + d);
          }
        });
      }

      // Tell scriptjs to load the scripts, name it
      $script(scripts, comp);

      // Define callback to fire when a top level component has finished loading
      $script.ready(comp, function() {
        $.each(init, (i, c) => {
          component[c].init();
        });
      });
    }
  });
});
