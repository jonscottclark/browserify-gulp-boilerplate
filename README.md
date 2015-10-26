# Browserify/Gulp Boilerplate

The objective of this boilerplate is to provide a quick jumping-off point to start developing standalone UI components and prototypes.

### Bundling

The project uses @zoubin's [`gulp-watchify-factor-bundle`](https://github.com/zoubin/gulp-watchify-factor-bundle)to abstract the process of transforming browserify entries that get split off from the common browserify bundle task by the [`factor-bundle`](https://github.com/substack/factor-bundle) plugin. *(Unfortunately, using `watchify` hasn't worked for me yet using this implementation, so Gulp will rebundle everything using a regular `gulp.watch` task. Sorry.)*

`factor-bundle` checks all entries defined in the browserify config and bundles any modules that are shared between these entries into a `common.js` file.

### Script loading

The boilerplate assumes you'll be developing UI components and templates to display them (in isolation, and alongside other components to form mockups of complete pages.

In your HTML, include `common.js`, then include a main `app.js` file which will check for the presence of these components on the page and asynchronously load their associated functionality with the `scriptjs` module (it's nicer than jQuery's `$.getScript`).

*(Another approach to the currently-implemented pattern is to use [`partition-bundle`](https://github.com/arian/partition-bundle), which is similar to `factor-bundle`, but it differs because it can dynamically include external scripts using `require()` and a chosen module name determined at build-time. The components could be written as CommonJS modules instead of being exposed globally after being loaded. Unfortunately, the documentation is sparse and I decided against using `partition-bundle` for the time being. Sorry I polluted the global scope.)*

### CSS

The recommended naming convention for components, utilities, JS identifiers, and state is borrowed from [@necolas](https://github.com/necolas), and is an extension of BEM syntax:

```css
/* Utility */
.u-utilityName {}

/* Component */
.ComponentName {}

/* Component modifier */
.ComponentName--modifierName {}

/* Component descendant */
.ComponentName-descendant {}

/* Component descendant modifier */
.ComponentName-descendant--modifierName {}

/* Component state (scoped to component) */
.ComponentName.is-stateOfComponent {}
```

Generally, the thoughts summed up in [this wonderful article](http://nicolasgallagher.com/about-html-semantics-front-end-architecture/) should guide your CSS authoring.

[PostCSS](https://github.com/postcss/postcss) is used for [autoprefixer](https://github.com/postcss/autoprefixer) and for post-compile optimizations using [cssnano](https://github.com/ben-eb/cssnano). You can add other processors as needed, like a BEM linter or statistics provider.

### Jade

The `index.jade` file is where you can display a list of all your components or pages, so that other developers can preview them.

Gulp takes care of some Jade-related things for us:

- Adds all files found in the `html/mixins` directory to an `html/_mixins.jade` file, so you can keep your mixins separated, but only include one file in your base layout to access them all.
- After generating your `pages` which may `include` components, adds a line to extend the default jade layout to the top of the component templates, so that the generated HTML yields a standalone page with all the required scaffolding.

### Gulp tasks

**Build, watch, spin up a dev server on port 9001**

`$ gulp`

**Build without any optimizations**

`$ gulp build`

**Build to production environment**

`$ gulp build --deploy`

---

[MIT License](http://jonscottclark.mit-license.org/) © Jon Scott Clark

MIT License © [Bin Zou](http://github.com/zoubin)
