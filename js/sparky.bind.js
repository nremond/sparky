
// Sparky.bind
//
// Binds data to the DOM. Changes in data are then immediately rendered
// in the nodes that display that data via template tags such as {{ name }}.
// Only those nodes containing the changed data are updated, other nodes are
// left alone. The actual DOM tree does not change. Template tags can also
// be used in the attributes href, title, id, class, style and value.
//
// dataBind(node, observeFn, unobserveFn, getFn)
//
// node
//
// A DOM node to use as a route. The inner DOM tree is traversed and references
// to property names written as {{ name }} cause bindFn to be called with name
// as property.
//
// bindFn(property, fn)
//
// Responsible for listening to changes to properties on a data object or model.
// When the named property changes, function fn must be called.
//
// getFn(property)
//
// Responsible for returning the value of the named property from a data object
// or model.


(function(Sparky) {
	"use strict";

	var assign = Object.assign;

	var dom = Sparky.dom;

	var attributes = [
		'href',
		'title',
		'id',
		'style',
		'src',
		'alt'
	];

	// Matches a sparky template tag, capturing (tag name, filter string)
	var rtags   = /(\{{2,3})\s*([\w\-\.\[\]]+)\s*(?:\|([^\}]+))?\s*\}{2,3}/g;

	// Matches tags plus any directly adjacent text
	var rclasstags = /[^\s]*\{{2,3}[^\}]+\}{2,3}[^\s]*/g;

	// Matches filter string, capturing (filter name, filter parameter string)
	var rfilter = /\s*([a-zA-Z0-9_\-]+)\s*(?:\:(.+))?/;

	// Matches anything with a space
	var rspaces = /\s+/;

	// Matches anything that contains a non-space character
	var rtext = /\S/;

	// Matches the arguments list in the result of a fn.toString()
	var rarguments = /function(?:\s+\w+)?\s*(\([\w\,\s]*\))/;

	var filterCache = {};

	var binders = {
	    	1: domNode,
	    	3: textNode,
	    	11: fragmentNode
	    };

	var empty = [];

	var changeEvent = new CustomEvent('valuechange', { bubbles: true });

	// Utility functions

	var slice = Function.prototype.call.bind(Array.prototype.slice);

	function noop() {}

	function returnThis() { return this; }

	function call(fn) { fn(); }

	function isDefined(n) {
		return !!n || n !== undefined && n !== null && !Number.isNaN(n);
	}

	function classOf(object) {
		return (/\[object\s(\w+)\]/.exec(Object.prototype.toString.apply(object)) || [])[1];
	}

	// Nodes that require special bindings
	var tags = {
	    	label: function(node, bind, unbind, get, set, create, unobservers) {
	    		bindAttribute(node, 'for', bind, unbind, get, unobservers);
	    		bindNodes(node, bind, unbind, get, set, create, unobservers);
	    	},

	    	input: function(node, bind, unbind, get, set, create, unobservers, scope) {
	    		var type = node.type;

	    		bindAttribute(node, 'value', bind, unbind, get, unobservers);
	    		bindAttribute(node, 'min', bind, unbind, get, unobservers);
	    		bindAttribute(node, 'max', bind, unbind, get, unobservers);

	    		var unbind = type === 'number' || type === 'range' ?
	    		    	// Only let numbers set the value of number and range inputs
	    		    	Sparky.bindNamedValueToObject(node, scope, numberToString, stringToNumber) :
	    		    // Checkboxes default to value "on" when the value attribute
	    		    // is not given. Make them behave as booleans.
	    		    type === 'checkbox' && !isDefined(node.getAttribute('value')) ?
	    		    	Sparky.bindNamedValueToObject(node, scope, booleanToStringOn, stringOnToBoolean) :
	    		    	// Only let strings set the value of other inputs
	    		    	Sparky.bindNamedValueToObject(node, scope, returnArg, returnArg) ;

	    		if (unbind) { unobservers.push(unbind); }
	    	},

	    	select: function(node, bind, unbind, get, set, create, unobservers, scope) {
	    		bindAttribute(node, 'value', bind, unbind, get, unobservers);
	    		bindNodes(node, bind, unbind, get, set, create, unobservers);

	    		// Only let strings set the value of selects
	    		var unbind = Sparky.bindNamedValueToObject(node, scope, returnArg, returnArg);
	    		if (unbind) { unobservers.push(unbind); }
	    	},

	    	option: function(node, bind, unbind, get, set, create, unobservers, scope) {
	    		bindAttribute(node, 'value', bind, unbind, get, unobservers);
	    		bindNodes(node, bind, unbind, get, set, create, unobservers);
	    	},

	    	textarea: function(node, bind, unbind, get, set, create, unobservers, scope) {
	    		// Only let strings set the value of a textarea
	    		var unbind = Sparky.bindNamedValueToObject(node, scope, returnArg, returnArg);
	    		if (unbind) { unobservers.push(unbind); }
	    	},

	    	time: function(node, bind, unbind, get, set, create, unobservers, scope)  {
	    		bindAttributes(node, bind, unbind, get, unobservers, ['datetime']);
	    		bindNodes(node, bind, unbind, get, set, create, unobservers);
	    	},

	    	path: function(node, bind, unbind, get, set, create, unobservers) {
	    		bindAttributes(node, bind, unbind, get, unobservers, ['d']);
	    	}
	    };

	function domNode(node, bind, unbind, get, set, create, scope) {
		var unobservers = [];
		var tag = node.tagName.toLowerCase();

		if (Sparky.debug === 'verbose') { console.group('Sparky: dom node: ', node); }

		bindClasses(node, bind, unbind, get, unobservers);
		bindAttributes(node, bind, unbind, get, unobservers, attributes);

		// Set up special binding for certain elements like form inputs
		if (tags[tag]) {
			tags[tag](node, bind, unbind, get, set, create, unobservers, scope);
		}

		// Or sparkify the child nodes
		else {
			bindNodes(node, bind, unbind, get, set, create, unobservers);
		}

		if (Sparky.debug === 'verbose') { console.groupEnd(); }

		return unobservers;
	}

	function textNode(node, bind, unbind, get, set, create) {
		var unobservers = [];

		if (Sparky.debug === 'verbose') { console.group('Sparky: text node:', node); }

		observeProperties(node.nodeValue, bind, unbind, get, function(text) {
			node.nodeValue = text;
		}, unobservers);

		if (Sparky.debug === 'verbose') { console.groupEnd(); }

		return unobservers;
	}

	function fragmentNode(node, bind, unbind, get, set, create) {
		var unobservers = [];

		if (Sparky.debug === 'verbose') { console.group('Sparky: fragment: ', node); }

		bindNodes(node, bind, unbind, get, set, create, unobservers);

		if (Sparky.debug === 'verbose') { console.groupEnd(); }

		return unobservers;
	}

	function bindNodes(node, bind, unbind, get, set, create, unobservers) {
		// Document fragments do not have a getAttribute method.
		var id = node.getAttribute && node.getAttribute('data-template');
		var template, nodes;

		if (isDefined(id)) {
			template = Sparky.template(id);

			// If the template does not exist, do nothing.
			if (!template) {
				Sparky.log('template "' + id + '" not found in DOM.');
				return;
			}

			// childNodes is a live list, and we don't want that because we may
			// be about to modify the DOM.
			nodes = slice(template.childNodes);

			// Insert the template on the next frame.
			window.requestAnimationFrame(function() {
				Sparky.dom.empty(node);
				Sparky.dom.append(node, template);
			});
		}
		else {
			// childNodes is a live list, and we don't want that because we may
			// be about to modify the DOM.
			nodes = slice(node.childNodes);
		}

		var n = -1;
		var l = nodes.length;
		var child, sparky, unbind;

		// Loop forwards through the children
		while (++n < l) {
			child = nodes[n];

			// Don't bind child nodes that have their own Sparky controllers.
			if (child.getAttribute && (
				isDefined(child.getAttribute('data-ctrl')) ||
				isDefined(child.getAttribute('data-scope'))
			)) {
				//create(child);
				sparky = create(child);
				unobservers.push(sparky.destroy.bind(sparky));
			}
			else if (binders[child.nodeType]) {
				unobservers.push.apply(unobservers, binders[child.nodeType](child, bind, unbind, get, set, create, scope));
			}
		}
	}

	function setAttributeSVG(node, attribute, value) {
		if (attribute = 'd') {
			node.setAttribute(attribute, value);
		}
		else {
			node.setAttributeNS(Sparky.xlink, attribute, value);
		}
	}

	function setAttributeHTML(node, attribute, value) {
		node.setAttribute(attribute, value);
	}

	function addClasses(classList, text) {
		var classes = text.trim().split(rspaces);
		classList.add.apply(classList, classes);
	}

	function removeClasses(classList, text) {
		var classes = text.trim().split(rspaces);
		classList.remove.apply(classList, classes);
	}

	function bindClasses(node, bind, unbind, get, unobservers) {
		var classes = dom.getClass(node);

		// If there are no classes, go no further
		if (!classes) { return; }

		// Remove tags and store them
		Sparky.rclasstags.lastIndex = 0;
		var tags = [];
		var text = classes.replace(Sparky.rclasstags, function($0) {
			tags.push($0);
			return '';
		});

		// Where no tags have been found, go no further
		if (!tags.length) { return; }

		// Now that we extracted the tags, overwrite the class with remaining text
		dom.setClass(node, text);

		// Create an update function for keeping sparky's classes up-to-date
		var classList = dom.classes(node);
		var update = function update(newText, oldText) {
		    	if (oldText && rtext.test(oldText)) { removeClasses(classList, oldText); }
		    	if (newText && rtext.test(newText)) { addClasses(classList, newText); }
		    };

		if (Sparky.debug === 'verbose') { console.log('Sparky: bind class="' + classes + ' ' + tags.join(' ') + '"'); }

		observeProperties(tags.join(' '), bind, unbind, get, update, unobservers);
	}

	function bindAttributes(node, bind, unbind, get, unobservers, attributes) {
		var a = attributes.length;

		while (a--) {
			bindAttribute(node, attributes[a], bind, unbind, get, unobservers);
		}
	}

	function bindAttribute(node, attribute, bind, unbind, get, unobservers) {
		var isSVG = node instanceof SVGElement;

		// Look for data- aliased attributes before attributes. This is
		// particularly important for the style attribute in IE, as it does not
		// return invalid CSS text content, so Sparky can't read tags in it.
		var alias = node.getAttribute('data-' + attribute) ;
		var value = alias ? alias : isSVG ?
		    	node.getAttributeNS(Sparky.xlink, attribute) || node.getAttribute(attribute) :
		    	node.getAttribute(attribute) ;

		if (!value) { return; }
		if (alias) { node.removeAttribute('data-' + attribute); }
		if (Sparky.debug === 'verbose') { console.log('Sparky: checking ' + attribute + '="' + value + '"'); }

		var update = isSVG ?
		    	setAttributeSVG.bind(this, node, attribute) :
		    	setAttributeHTML.bind(this, node, attribute) ;

		observeProperties(value, bind, unbind, get, update, unobservers);
	}

	function toFilter(filter) {
		var parts = rfilter.exec(filter);

		return {
			name: parts[1],
			fn: Sparky.filters[parts[1]],

			// Leave the first arg empty. It will be populated with the value to
			// be filtered when the filter fn is called.
			args: parts[2] && JSON.parse('["",' + parts[2].replace(/\'/g, '\"') + ']') || []
		};
	}

	function applyFilters(word, filterString) {
		var filters = filterCache[filterString] || (
		    	filterCache[filterString] = filterString.split('|').map(toFilter)
		    );
		var l = filters.length;
		var n = -1;
		var args;

		while (++n < l) {
			if (!filters[n].fn) {
				throw new Error('Sparky: filter \'' + filters[n].name + '\' does not exist in Sparky.filters');
			}

			if (Sparky.debug === 'filter') {
				console.log('Sparky: filter:', filters[n].name, 'value:', word, 'args:', filters[n].args);
			}

			args = filters[n].args;
			args[0] = word;
			word = filters[n].fn.apply(Sparky, args);
		}

		return word;
	}

	function extractProperties(str, live, dead) {
		Sparky.rtags.lastIndex = 0;
		str.replace(Sparky.rtags, function($0, $1, $2){
			// Sort the live properties from the dead properties.
			var i;

			// If it's already in live, our work here is done
			if (live.indexOf($2) !== -1) { return; }

			// It's a live tag, so put it in live, and if it's already
			// in dead remove it from there.
			if ($1.length === 2) {
				live.push($2);
				i = dead.indexOf($2);
				if (i !== -1) { dead.splice(i, 1); }
			}

			// It's a dead tag, check if it's in dead and if not stick
			// it in there.
			else if (dead.indexOf($2) === -1) {
				dead.push($2);
			}
		});
	}

	function makeReplaceText(get) {
		return function replaceText($0, $1, $2, $3) {
			var value1 = get($2);
			var value2 = $3 ? applyFilters(value1, $3) : value1 ;
			return !isDefined(value2) ? '' :
				typeof value2 === 'string' ? value2 :
				typeof value2 === 'number' ? value2 :
				typeof value2 === 'boolean' ? value2 :
				// Beautify the .toString() result of functions
				typeof value2 === 'function' ? (value2.name || 'function') + (rarguments.exec(value2.toString()) || [])[1] :
				// Use just the Class string in '[object Class]'
				classOf(value2) ;
		}
	}

	function makeUpdateText(text, get, fn) {
		var replaceText = makeReplaceText(get);
		var oldText;

		return function updateText() {
			Sparky.rtags.lastIndex = 0;
			var newText = text.replace(Sparky.rtags, replaceText);
			fn(newText, oldText);
			oldText = newText;
		}
	}

	function observeProperties(text, bind, unbind, get, fn, unobservers) {
		var live = [];
		var dead = [];

		// Populate live and dead property lists
		extractProperties(text, live, dead);

		if (live.length === 0 && dead.length === 0) { return; }

		var update = makeUpdateText(text, get, fn);

		if (live.length) {
			unobservers.push(observeProperties2(bind, unbind, update, live));
		}
		else {
			update();
		}
	}

	function observeProperties2(bind, unbind, update, properties) {
		// Start throttling changes. The first update is immediate.
		var throttle = Sparky.Throttle(update);

		// Observe properties that are to be live updated
		properties.forEach(function attach(property) {
			bind(property, throttle);
		});

		// Return a function that destroys live bindings
		return function destroyBinding() {
			properties.forEach(function detach(property) {
				// Unobserve properties
				unbind(property, throttle);
			});

			// Cancel already bound updates. If updates are queued,
			// the throttle applies them before bowing out.
			throttle.cancel();
		};
	}

	function bind(sparky, observe, unobserve, get, set, create, scope) {
		var unobservers = Array.prototype.concat.apply([], sparky.map(function(node) {
			return binders[node.nodeType](node, observe, unobserve, get, set, create, scope);
		}));

		sparky.on('destroy', function() {
			unobservers.forEach(call);
		});
	}

	assign(Sparky, {
		bind: bind,
		attributes: attributes,

		// Todo: We expose these regexes so we can change tag delimiters. Find
		// a better way to declare just the tag delimiters without exposing
		// these regexes.
		rtags: rtags,
		rspaces: rspaces,
		rclasstags: rclasstags
	});

	// 2-way binding for form elements.
	// HTML form elements are hard to handle. They do all sorts of strange
	// things such as radios and checkboxes having a default value of 'on'
	// where a value attribute is not given. This set of functions handles
	// 2-way binding between a node and an object.

	function dispatchInputChangeEvent(node) {
		// FireFox won't dispatch any events on disabled inputs so we need to do
		// a little dance, enabling it quickly, sending the event and disabling
		// it again.
		if (!dom.features.inputEventsOnDisabled && node.disabled) {
			node.disabled = false;

			// We have to wait, though. It's not clear why. This makes it async,
			// but let's not worry too much about that.
			setTimeout(function() {
				node.dispatchEvent(changeEvent);
				node.disabled = true;
			}, 0);
		}
		else {
			node.dispatchEvent(changeEvent);
		}
	}

	function makeUpdateInput(node, model, path, fn) {
		var type = node.type;

		return type === 'radio' || type === 'checkbox' ?
			function updateChecked() {
				var value = fn(Sparky.get(model, path));
				var checked = node.value === value;

				// Don't set checked state if it already has that state, and
				// certainly don't simulate a change event.
				if (node.checked === checked) { return; }

				node.checked = checked;

				dispatchInputChangeEvent(node);
			} :
			function updateValue() {
				var value = fn(Sparky.get(model, path));

				if (typeof value === 'string') {
					// Check against the current value - resetting the same
					// string causes the cursor to jump in inputs, and we dont
					// want to send a change event where nothing changed.
					if (node.value === value) { return; }

					node.value = value;
				}
				else {
					node.value = '';
				}

				dispatchInputChangeEvent(node);
			} ;
	}

	function makeChangeListener(node, model, path, fn) {
		var type = node.type;

		return type === 'radio' ? function radioChange(e) {
				if (node.checked) {
					Sparky.set(model, path, fn(node.value));
				}
			} :
			type === 'checkbox' ? function checkboxChange(e) {
				Sparky.set(model, path, fn(node.checked ? node.value : undefined));
			} :
			function valueChange(e) {
				Sparky.set(model, path, fn(node.value));
			} ;
	}

	function bindPathToValue(node, model, path, to, from) {
		var nodeValue = node.getAttribute('value');
		var update = makeUpdateInput(node, model, path, to);
		var change = makeChangeListener(node, model, path, from);
		var throttle;

		node.addEventListener('change', change);
		node.addEventListener('input', change);

		// Wait for animation frame to let Sparky fill in tags in value, min
		// and max before controlling. TODO: I'm not sure about this. I'd like
		// to update the model immediately if possible, and start throttle on
		// the animation frame.

		var request = window.requestAnimationFrame(function() {
			request = false;

			// Where the model does not have value, set it from the node value.
			if (!isDefined(Sparky.get(model, path))) {
				change();
			}

			throttle = Sparky.Throttle(update);
			Sparky.observePath(model, path, throttle);
		});

		return function unbind() {
			node.removeEventListener('change', change);
			node.removeEventListener('input', change);

			if (request) {
				window.cancelAnimationFrame(request);
			}
			else {
				throttle.cancel();
				Sparky.unobservePath(model, path, throttle);
			}
		};
	}

	function bindNamedValueToObject(node, model, to, from) {
		var name = node.name;

		if (!node.name) {
			console.warn('Sparky: Cannot bind value of node with empty name.', node);
			return;
		}

		Sparky.rtags.lastIndex = 0;
		var tag = (Sparky.rtags.exec(name) || empty);
		var path = tag[2];

		if (!path) { return; }

		if (tag[3]) {
			console.warn('Sparky: Sparky tags in name attributes do not accept filters. Ignoring name="' + name + '".');
			return;
		}

		// Take the tag parentheses away from the name, preventing this node
		// from being name-value bound by any other controllers.
		node.name = name.replace(Sparky.rtags, path);

		return bindPathToValue(node, model, path, to, from);
	}


	// Controllers

	function returnArg(arg) { return arg; }

	function toString(value) { return '' + value; }

	function stringToNumber(value) {
		// coerse to number
		var n = parseFloat(value);
		return Number.isNaN(n) ? undefined :
			n ;
	}

	function stringToInteger(value) {
		// coerse to number
		var n = parseFloat(value);
		return Number.isNaN(n) ? undefined :
			Math.round(n) ;
	}

	function stringToBoolean(value) {
		return value === 'false' ? false :
			value === '0' ? false :
			value === '' ? false :
			!!value ;
	}

	function stringToBooleanInverted(value) {
		return !stringToBoolean(value);
	}

	function stringOnToBoolean(value) {
		return value === 'on' ;
	}

	function stringOnToBooleanInverted(value) {
		return value !== 'on';
	}

	function definedToString(value) {
		return isDefined(value) ? value + '' :
			undefined ;
	}

	function numberToString(value) {
		return typeof value === 'number' ? value + '' :
			undefined ;
	}

	function integerToString(value) {
		return typeof value === 'number' && value % 1 === 0 ? value + '' :
			undefined ;
	}

	function booleanToString(value) {
		return typeof value === 'boolean' ? value + '' :
			typeof value === 'number' ? !!value + '' :
			undefined ;
	}

	function booleanToStringInverted(value) {
		return typeof value === 'boolean' ? !value + '' :
			typeof value === 'number' ? !value + '' :
			undefined ;
	}

	function booleanToStringOn(value) {
		return typeof value === 'boolean' || typeof value === 'number' ?
			value ? 'on' : '' :
			undefined ;
	}

	function booleanToStringOnInverted(value) {
		return typeof value === 'boolean' || typeof value === 'number' ?
			value ? '' : 'on' :
			undefined ;
	}

	function valueAnyCtrl(node, model) {
		// Coerce any defined value to string so that any values pass the type checker
		var unbind = Sparky.bindNamedValueToObject(node, model, definedToString, returnArg);
		if (unbind) { this.on('destroy', unbind); }
	}

	function valueStringCtrl(node, model) {
		// Don't coerce so that only strings pass the type checker
		var unbind = Sparky.bindNamedValueToObject(node, model, returnArg, returnArg);
		if (unbind) { this.on('destroy', unbind); }
	}

	function valueNumberCtrl(node, model) {
		var unbind = Sparky.bindNamedValueToObject(node, model, numberToString, stringToNumber);
		if (unbind) { this.on('destroy', unbind); }
	}

	function valueIntegerCtrl(node, model) {
		var unbind = Sparky.bindNamedValueToObject(node, model, numberToString, stringToInteger);
		if (unbind) { this.on('destroy', unbind); }
	}

	function valueBooleanCtrl(node, model) {
		var type = node.type;
		var unbind = type === 'checkbox' && !isDefined(node.getAttribute('value')) ?
		    	Sparky.bindNamedValueToObject(node, model, booleanToStringOn, stringOnToBoolean) :
		    	Sparky.bindNamedValueToObject(node, model, booleanToString, stringToBoolean) ;
		if (unbind) { this.on('destroy', unbind); }
	}

	function valueBooleanInvertCtrl(node, model) {
		var type = node.type;
		var unbind = type === 'checkbox' && !isDefined(node.getAttribute('value')) ?
		    	Sparky.bindNamedValueToObject(node, model, booleanToStringOnInverted, stringOnToBooleanInverted) :
		    	Sparky.bindNamedValueToObject(node, model, booleanToStringInverted, stringToBooleanInverted);
		if (unbind) { this.on('destroy', unbind); }
	}

	function valueNumberInvertCtrl(node, model) {
		var min = node.min ? parseFloat(node.min) : (node.min = 0) ;
		var max = mode.max ? parseFloat(node.max) : (node.max = 1) ;

		var unbind = Sparky.bindNamedValueToObject(node, model, function to(value) {
			return typeof value !== 'number' ? '' : ('' + ((max - value) + min));
		}, function from(value) {
			var n = parseFloat(value);
			return Number.isNaN(n) ? undefined : ((max - value) + min) ;
		});

		if (unbind) { this.on('destroy', unbind); }
	};


	assign(Sparky.ctrl, {
		'value-any':            valueAnyCtrl,
		'value-string':         valueStringCtrl,

		'value-number':         function(argument) {
			console.warn('Sparky: value-number controller is renamed to value-float (or value-int).');
			return valueNumberCtrl.apply(this, arguments);
		},

		'value-number-invert':         function(argument) {
			console.warn('Sparky: value-number-invert controller is renamed to value-float-invert (or value-int-invert).');
			return valueNumberInvertCtrl.apply(this, arguments);
		},

		'value-float':          valueNumberCtrl,
		'value-int':            valueIntegerCtrl,
		'value-number-invert':  valueNumberInvertCtrl,
		'value-boolean':        valueBooleanCtrl,
		'value-boolean-invert': valueBooleanInvertCtrl
	});


	// Expose

	Sparky.bindNamedValueToObject = bindNamedValueToObject;
})(Sparky);