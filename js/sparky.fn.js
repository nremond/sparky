
// Sparky.fn

(function(window) {
	var Sparky = window.Sparky;

	// Stops Sparky from parsing the node.
	Sparky.fn.ignore = function ignore() {
		this.interrupt();
	};
})(this);

(function(window) {
	var Sparky = window.Sparky;

	// Detect IE
	var isIE = !!(document.all && document.compatMode || window.navigator.msPointerEnabled);

	// Logs nodes, scopes and data.
	Sparky.fn.log = function(node, scopes) {
		var sparky = this;

		// In IE11 and probably below, and possibly Edge, who knows,
		// console.groups can arrive in really weird orders. They are not at all
		// useful for debugging as a result. Rely on console.log.

		function log(scope) {
			console[isIE ? 'log' : 'group']('Sparky: scope ' + Sparky.nodeToString(node));
			console.log('data ', sparky.data);
			console.log('scope', scope);
			console.log('fn   ', sparky.fn);
			console[isIE ? 'log' : 'groupEnd']('---');
		}

		console[isIE ? 'log' : 'group']('Sparky: run   ' + Sparky.nodeToString(node));
		console.log('data ', sparky.data);
		console[isIE ? 'log' : 'groupEnd']('---');

		return scopes.tap(log);
	};
})(this);

(function(window) {
	"use strict";

	var assign = Object.assign;
	var Sparky = window.Sparky;
	var dom    = Sparky.dom;

	assign(Sparky.fn, {
		"remove-hidden": function(node, scopes) {
			scopes.tap(function() {
				window.requestAnimationFrame(function() {
					dom.classes(node).remove('hidden');
				});
			});
		}
	});
})(this);

(function(window) {
	"use strict";

	var assign = Object.assign;
	var Sparky = window.Sparky;

	assign(Sparky.fn, {
		html: function(node, scopes) {
			scopes.tap(function(html) {
				node.innerHTML = html;
			});
		}
	});
})(this);

(function(window) {
	"use strict";

	var Fn = window.Fn;

	function preventDefault(e) {
		e.preventDefault();
	}

	Sparky.scope = function(node) {
		console.warn('Sparky: Sparky.scope() deprecated in favour of Sparky.getScope()')
		return Sparky.getScope(node);
	};

	Sparky.setScope = function(node, scope) {
		if (!window.jQuery) {
			throw new Error('data-fn="store-scope" requires jQuery.');
		}

		window.jQuery && jQuery.data(node, 'scope', scope);
	};

	Sparky.getScope = function(node) {
		if (!window.jQuery) {
			throw new Error('data-fn="store-scope" requires jQuery.');
		}

		return jQuery.data(node, 'scope');
	};

	Object.assign(Sparky.fn, {
		"prevent-click": function(node) {
			node.addEventListener('click', preventDefault);
			this.on('destroy', function() {
				node.removeEventListener('click', preventDefault);
			});
		},

		"prevent-submit": function(node) {
			node.addEventListener('submit', preventDefault);
			this.on('destroy', function() {
				node.removeEventListener('submit', preventDefault);
			});
		},

		"ajax-on-submit": function(node, scopes) {
			var method = node.getAttribute('method') || 'POST';
			var url = node.getAttribute('action');

			if (!Fn.isDefined(url)) {
				throw new Error('Sparky: fn ajax-on-submit requires an action="url" attribute.');
			}

			var submit;

			node.addEventListener('submit', preventDefault);

			scopes.tap(function(scope) {
				if (submit) { node.removeEventListener(submit); }
				submit = function(e) {
					jQuery.ajax({
						type: method.toLowerCase(),
						url:  url,
						data: JSON.stringify(scope),
						dataType: 'json'
					})
					.then(function(value) {
						console.log(value);
					});
				};
				node.addEventListener('submit', submit);
			})

			this
			.on('destroy', function() {
				node.removeEventListener('submit', submit);
			});
		},

		"scope": function(node, scopes) {
			scopes.tap(function(scope) {
				Sparky.setScope(node, scope);
			});
		}
	});
})(this);


(function() {
	"use strict";

	Sparky.fn['x-scroll-slave'] = function(node) {
		var name = node.getAttribute('data-x-scroll-master');
		var master;

		function update() {
			node.scrollLeft = master.scrollLeft;
		}

		this
		.on('dom-add', function() {
			master = document.getElementById(name);

			if (!master) {
				console.error(node);
				throw new Error('Sparky scroll-x-slave: id="' + name + '" not in the DOM.');
			}

			master.addEventListener('scroll', update);
			update();
		})
		.on('destroy', function() {
			if (!master) { return; }
			master.removeEventListener('scroll', update);
		});
	};

	Sparky.fn['y-scroll-slave'] = function(node) {
		var name = node.getAttribute('data-y-scroll-master');
		var master = document.getElementById(name);

		if (!master) {
			console.error(node);
			throw new Error('Sparky scroll-x-slave: id="' + name + '" not in the DOM.');
		}

		function update() {
			node.scrollTop = master.scrollTop;
		}

		master.addEventListener('scroll', update);
		update();

		this.on('destroy', function() {
			master.removeEventListener('scroll', update);
		});
	};
})();
