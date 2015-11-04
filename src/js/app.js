import $         from 'jquery';
import fastclick from 'fastclick';
import $script   from 'scriptjs';

// Config
const basePath = '../js';

// https://www.npmjs.com/package/fastclick
fastclick(document.body);

// https://github.com/paulirish/matchMedia.js/
if (!Modernizr.mq('only all')) {
  $script(basePath + '/vendor/matchMedia.js');
}

// Namespace for our components
window.component = {};

$(() => {

  // Load component scripts
  let components = {
    'Nav': [],
    'Hero': []
  };

  $.each(components, (comp, dep) => {
    if ($('.' + comp).length) {
      let deps = [basePath + '/components/' + comp + '.js'];

      if (dep.length) {
        $.each(dep, (i, d) => {
          deps.push(basePath + d);
        });
      }

      $script(deps, comp);

      $script.ready(comp, () => {
        component[comp].init();
      });
    }
  });
});
