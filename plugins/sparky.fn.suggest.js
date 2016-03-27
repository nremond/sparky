(function(window) {
	var Sparky = window.Sparky;

	function wrap(i, min, max) {
		return i < min ? max - (min - i) :
			i >= max ? min + (i - max) :
			i ;
	}

	function Throttle(fn, time) {
		var flag = false;
		var context, args;

		function update() {
			fn.apply(context, args);
			flag = false;
		}

		return function() {
			context = this;
			args = arguments;

			if (flag) { return; }
			flag = true;

			setTimeout(update, time);
		};
	}

	var request = Throttle(function request(url, tip, node) {
		jQuery
		.ajax(url)
		.then(function(data) {
			if (!data || data.length === 0) { return; }
			tip.scope(Collection(data));

			var elem = tip.tojQuery();

			window.requestAnimationFrame(function() {
				elem.trigger({ type: 'activate', relatedTarget: node });

				var inputs = elem.find('input');

				var i = 0;

				inputs.eq(i).addClass('focus');

				console.log(i, inputs.eq(i)[0]);

				node.addEventListener('keydown', function(e) {
					if (e.keyCode === 38) {
						e.preventDefault();
						console.log('UP');
						inputs.eq(i).removeClass('focus');
						i = wrap(i - 1, 0, inputs.length);
						inputs.eq(i).addClass('focus');
					}
					else if (e.keyCode === 40) {
						e.preventDefault();
						console.log('DOWN');
						inputs.eq(i).removeClass('focus');
						i = wrap(i + 1, 0, inputs.length);
						inputs.eq(i).addClass('focus');
					}
					else if (e.keyCode === 13) {
						e.preventDefault();
						console.log('RETURN');
						inputs.eq(i)[0].checked = true;
						Sparky.dom.trigger(inputs.eq(i)[0], 'valuechange');
					}
				});
			});
		});
	}, 320);

	Sparky.fn.suggest = function(node) {
		if (Sparky.dom.tag(node) !== 'input') {
			console.warn('Sparky: data-fn="suggest" can only be applied to an <input>.');
			return;
		}

		var id = node.getAttribute('data-suggest-template');
		var url = node.getAttribute('data-suggest-url');
		var minlength = parseInt(node.getAttribute('data-suggest-minlength') || 3, 10);

		if (!id || !url) {
			console.warn('Sparky: data-fn="suggest" requires attributes data-suggest-template and data-suggest-url.', node);
			return;
		}

		var tip = Sparky(id);

		var scope;

		function listen(tip) {
			function update(value) {
				node.value = value;
				jQuery(tip).trigger('deactivate');
				Sparky.dom.trigger(node, 'valuechange');
				window.requestAnimationFrame(function() {
					// Refocus the original input
					node.focus();
				});
			}

			function change(e) {
				if (!e.target.checked) { return; }
				update(e.target.value);
			}

			tip.addEventListener('change', change);
			tip.addEventListener('valuechange', change);
		}

		Sparky.dom.append(document.body, tip);

		listen(tip.filter(Sparky.dom.isElementNode)[0]);

		node.addEventListener('input', function(e) {
			var text = e.target.value;

			if (text.length < minlength) {
				jQuery(tip).trigger('deactivate');
				return;
			}

			request(url + text, tip, node);
		});

		this.on('scope', function(sparky, newscope) {
			scope = newscope;
		});

		node.addEventListener('blur', function(e) {
			jQuery(tip).trigger('deactivate');
		});
	};
})(this);