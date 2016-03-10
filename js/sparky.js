(function(window) {
	if (!window.console || !window.console.log) { return; }

	console.log('Sparky');
	console.log('http://github.com/cruncher/sparky');
	console.log('_________________________________');
})(this);


(function(window) {
	"use strict";

	var assign = Object.assign;

	var errors = {
		"node-not-found": "Sparky: Sparky(node) called, node not found: #{{$0}}"
	}

	// Debug

	function nodeToText(node) {
		return [
			'<',
			Sparky.dom.tag(node),
			//(node.className ? ' class="' + node.className + '"' : ''),
			//(node.getAttribute('href') ? ' href="' + node.getAttribute('href') + '"' : ''),
			(node.getAttribute('data-fn') ? ' data-fn="' + node.getAttribute('data-fn') + '"' : ''),
			(node.getAttribute('data-scope') ? ' data-scope="' + node.getAttribute('data-scope') + '"' : ''),
			(node.id ? ' id="' + node.id + '"' : ''),
			'>'
		].join('');
	}

	function log() {
		if (!Sparky.debug) { return; }
		var array = ['Sparky:'];
		Array.prototype.push.apply(array, arguments);
		console.log.apply(console, array);
	}

	function logVerbose() {
		if (Sparky.debug !== 'verbose') { return; }
		var array = ['Sparky:'];
		Array.prototype.push.apply(array, arguments);
		console.log.apply(console, array);
	}


	// Utility functions

	function noop() {}

	function returnNoop() {}

	function returnThis() { return this; }

	function returnArg(arg) { return arg; }

	function isDefined(n) {
		return n !== undefined && n !== null && !Number.isNaN(n);
	}

	function classOf(object) {
		return (/\[object\s(\w+)\]/.exec(Object.prototype.toString.apply(object)) || [])[1];
	}


	// Sparky

	function resolveNode(node) {
		// If node is a string, assume it is the id of a template,
		// and if it is not a template, assume it is the id of a
		// node in the DOM.
		return typeof node === 'string' ?
			(Sparky.template(node) || document.getElementById(node)) :
			node ;
	}

	function resolveScope(node, scope, data, observe, update) {
		// No getAttribute method (may be a fragment), use current scope.
		if (!node.getAttribute) {
			return update(scope);
		}

		var path = node.getAttribute('data-scope');

		// No data-scope attribute, use current scope.
		if (!isDefined(path)) {
			return update(scope);
		}

		// data-scope="{{path.to.data}}", find new scope in current scope.
		Sparky.rtags.lastIndex = 0;
		var parsedPath = Sparky.rtags.exec(path);
		if (parsedPath) {
			path = parsedPath[2];
		}

		// data-scope="path.to.data", find new scope in data.
		else {
			scope = data;
		}

		return scope && path ?
			observe(scope, path) :
			update(scope);
	}

	function resolveFn(node, fn, ctrl) {
		// The ctrl list can be a space-separated string of ctrl paths,
		return typeof fn === 'string' ? makeFn(fn, ctrl) :
			// a function,
			typeof fn === 'function' ? makeDistributeFn([fn]) :
			// an array of functions,
			typeof fn === 'object' ? makeDistributeFn(fn) :
			// or defined in the data-fn attribute
			node.getAttribute && makeFn(node.getAttribute('data-fn'), ctrl) ;
	}

	function makeDistributeFn(list) {
		return function distributeFn(node, model) {
			// Distributor controller
			var l = list.length;
			var n = -1;
			var scope = model;
			var result;

			// TODO: This is exposes solely so that ctrl
			// 'observe-selected' can function in sound.io.
			// Really naff. Find a better way.
			this.ctrls = list;

			var flag = false;

			this.interrupt = function interrupt() {
				flag = true;
				return list.slice(n + 1);
			};

			while (++n < l) {
				// Call the list of ctrls, in order.
				result = list[n].call(this, node, scope);

				// Returning false interrupts the fn calls.
				if (flag) { return false; }

				// Returning an object sets that object to
				// be used as scope.
				if (result !== undefined) { scope = result; }
			}

			return scope;
		};
	}

	function makeDistributeFnFromPaths(paths, ctrls) {
		var list = [];
		var l = paths.length;
		var n = -1;
		var ctrl;

		while (++n < l) {
			ctrl = Sparky.get(ctrls, paths[n]);

			if (!ctrl) {
				throw new Error('Sparky: data-fn "' + paths[n] + '" not found in sparky.ctrl');
			}

			list.push(ctrl);
		}

		return makeDistributeFn(list);
	}

	function makeFn(string, ctrls) {
		if (!isDefined(string)) { return; }
		var paths = string.trim().split(Sparky.rspaces);
		return makeDistributeFnFromPaths(paths, ctrls);
	}

	function replaceWithComment(node, i, sparky) {
		// If debug use comments as placeholders, otherwise use text nodes.
		var placeholder = Sparky.debug ?
			Sparky.dom.create('comment', Sparky.dom.tag(node)) :
			Sparky.dom.create('text', '') ;
		Sparky.dom.before(node, placeholder);
		Sparky.dom.remove(node);
		return placeholder;
	}

	function replaceWithNode(node, i, sparky) {
		var placeholder = sparky.placeholders[i];
		Sparky.dom.before(placeholder, node);
		Sparky.dom.remove(placeholder);
	}

	function setup(scope, bindings, init) {
		var n = bindings.length;
		var path, fn, throttle;

		while (n--) {
			path = bindings[n][0];
			fn = bindings[n][1];
			throttle = bindings[n][2];

			if (path) {
				// On initial run we populate the DOM immediately. The Sparky
				// constructor is designed to be run inside requestAnimationFrame
				// and we don't want to waiting for an extra frame.
				Sparky.observePath(scope, path, throttle, !init);
				if (init) {
					fn(Sparky.get(scope, path));
				}
			}
			else {
				fn();
			}
		}
	}

	function teardown(scope, bindings) {
		var n = bindings.length;
		var path, throttle;

		while (n--) {
			path = bindings[n][0];
			throttle = bindings[n][2];
			Sparky.unobservePath(scope, path, throttle);
		}
	}

	function destroy(bindings) {
		var n = bindings.length;
		var throttle;

		while (n--) {
			throttle = bindings[n][2];
			throttle.cancel();
		}

		bindings.length = 0;
	}

	function addNodes(sparky) {
		if (!sparky.placeholders) {
			// If nodes are already in the DOM trigger the event.
			// Can't use document.contains - doesn't exist in IE9.
			if (document.body.contains(sparky[0])) {
				sparky.trigger('dom-add');
			}

			return;
		}
		sparky.forEach(replaceWithNode);
		sparky.placeholders = false;
		sparky.trigger('dom-add');
	}

	function removeNodes(sparky) {
		if (sparky.placeholders) { return; }
		sparky.placeholders = sparky.map(replaceWithComment);
		sparky.trigger('dom-remove');
	}

	function updateNodes(sparky, scope, addNodes, addThrottle, removeNodes, removeThrottle, init) {
		// Where there is scope, the nodes should be added to the DOM, if not,
		// they should be removed.
		if (scope) {
			if (init) { addNodes(sparky, init); }
			else { addThrottle(sparky); }
		}
		else {
			if (init) { removeNodes(sparky); }
			else { removeThrottle(sparky); }
		}
	}

	function Sparky(node, scope, fn, parent) {
		// Allow calling the constructor with or without 'new'.
		if (!(this instanceof Sparky)) {
			return new Sparky(node, scope, fn, parent);
		}

		var sparky = this;
		var init = true;
		var initscope = scope;
		var ctrlscope;

		// Use scope variable as current scope.
		scope = undefined;

		var bindings = [];
		var nodes = [];
		var data = parent ? parent.data : Sparky.data;
		var ctrl = parent ? parent.fn : Sparky.fn;
		var unobserveScope = noop;
		var addThrottle = Sparky.Throttle(addNodes);
		var removeThrottle = Sparky.Throttle(removeNodes);

		function updateScope(object) {
			// If scope is unchanged, do nothing.
			if (scope === (ctrlscope || object)) { return; }

			// If old scope exists, tear it down
			if (scope) { teardown(scope, bindings); }

			// ctrlscope trumps new objects
			scope = ctrlscope || object;

			// Assign and set up scope
			if (scope) { setup(scope, bindings, init); }

			// Trigger scope first, children assemble themselves
			sparky.trigger('scope', scope);

			// Then update this node
			updateNodes(sparky, scope, addNodes, addThrottle, removeNodes, removeThrottle, init);
			init = false;
		}

		function observeScope(scope, path) {
			unobserveScope();
			unobserveScope = function() {
				Sparky.unobservePath(scope, path, updateScope);
			};
			Sparky.observePath(scope, path, updateScope, true);
		}

		node = resolveNode(node);

		if (!node) {
			throw new Error("Sparky: Sparky(node) – node not found: " + node);
		}

		Sparky.logVerbose('Sparky(', node, initscope, fn && (fn.call ? fn.name : fn), ')');

		//	typeof node === 'string' ? node :
		//	Sparky.dom.isFragmentNode(node) ? node :
		//	nodeToText(node), ',',
		//	(scope && '{}'), ',',
		//	(fn && (fn.name || 'anonymous')), ')');

		fn = resolveFn(node, fn, ctrl);

		// Define data and ctrl inheritance
		Object.defineProperties(this, {
			data: { value: Object.create(data), writable: true },
			fn:   { value: Object.create(ctrl) },
			placeholders: { writable: true }
		});

		this.scope = function(object) {
			resolveScope(node, object, parent ? parent.data : Sparky.data, observeScope, updateScope);
			return this;
		};

		// Setup this as a Collection of nodes. Where node is a document
		// fragment, assign all it's children to sparky collection.
		Collection.call(this, node.nodeType === 11 ? node.childNodes : [node]);

		// Todo: SHOULD be able to get rid of this, if ctrl fns not required to
		// accept scope as second parameter. Actually, no no no - the potential
		// scope must be passed to the fn, as the fn may return a different
		// scope and has no access to this one otherwise.
		resolveScope(node, initscope, parent ? parent.data : Sparky.data, function(basescope, path) {
			ctrlscope = Sparky.get(basescope, path);
		}, function(object) {
			ctrlscope = object;
		});

		// If fn is to be called and a scope is returned, we use that.
		if (fn) {
			ctrlscope = fn.call(sparky, node, ctrlscope) ;
		}

		// A controller returning false is telling us not to do data
		// binding. We can skip the heavy work.
		if (ctrlscope === false) {
			this
			.on('destroy', function() {
				Sparky.dom.remove(this);
			});

			// Todo: We don't ALWAYS want to call .scope() here.
			// if (initscope) { this.scope(initscope); }
			this.scope(initscope);

			init = false;
			return;
		}

		// If ctrlscope is unchanged from scope, ctrlscope should not override
		// scope changes. There's probably a better way of expressing this.
		if (ctrlscope === initscope) { ctrlscope = undefined; }

		// Parse the DOM nodes for Sparky tags. The parser returns a function
		// that kills it's throttles and so on.
		var unparse = Sparky.parse(sparky,
			function get(path) {
				return scope && Sparky.get(scope, path);
			},

			function set(property, value) {
				scope && Sparky.set(scope, property, value);
			},

			function bind(path, fn) {
				if (!fn) {
					fn = path;
					path = false;
				}

				bindings.push([path, fn, Sparky.Throttle(fn)]);
			},

			function unbind(fn) {
				var n = bindings.length;
				while (n--) {
					if (bindings[n][1] === fn) {
						bindings.splice(n, 1);
						return;
					}
				}
			},

			function create(node) {
				nodes.push(node);
			}
		);

		this.on('destroy', function() {
			Sparky.dom.remove(this);
			this.placeholders && Sparky.dom.remove(this.placeholders);
			unparse();
			unobserveScope();
			teardown(scope, bindings);
			destroy(bindings);
		});

		// Instantiate children AFTER this sparky has been fully wired up. Not
		// sure why. Don't think it's important.
		nodes.forEach(function(node) {
			return sparky.create(node, scope);
		});

		// If there is scope, set it up now
		if (initscope || ctrlscope) { this.scope(initscope || ctrlscope); }

		init = false;
	}

	Sparky.prototype = Object.create(Collection.prototype);

	assign(Sparky.prototype, {
		// Create a child Sparky dependent upon this one.
		create: function(node, scope, fn) {
			var boss = this;
			var sparky = Sparky(node, scope, fn, this);

			function destroy() { sparky.destroy(); }
			function updateScope(self, scope) { sparky.scope(scope); }

			// Bind events...
			this
			.on('destroy', destroy)
			.on('scope', updateScope);

			return sparky.on('destroy', function() {
				boss
				.off('destroy', destroy)
				.off('scope', updateScope);
			});
		},

		// Unbind and destroy Sparky bindings and nodes.
		destroy: function destroy() {
			return this.trigger('destroy').off();
		},

		scope: returnThis,

		interrupt: function interrupt() { return []; },

		// Returns sparky's element nodes wrapped as a jQuery object. If jQuery
		// is not present, returns undefined.
		tojQuery: function() {
			if (!window.jQuery) { return; }
			return jQuery(this.filter(Sparky.dom.isElement));
		}
	});

	// Export

	assign(Sparky, {
		debug: false,
		log: log,
		logVerbose: logVerbose,

		noop:       noop,
		returnThis: returnThis,
		returnArg:  returnArg,
		isDefined:  isDefined,
		classOf:    classOf,

		svgNamespace:   "http://www.w3.org/2000/svg",
		xlinkNamespace: "http://www.w3.org/1999/xlink",
		data: {},
		fn:   {},

		template: function(id, node) {
			return Sparky.dom.template.apply(this, arguments);
		}
	});

	window.Sparky = Sparky;
})(this);
