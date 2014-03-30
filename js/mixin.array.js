(function(ns, undefined) {
	"use strict";

	var mixin = ns.mixin || (ns.mixin = {});

	function remove(array, obj, i) {
		if (i === undefined) { i = -1; }

		while (++i < array.length) {
			if (obj === array[i]) {
				array.splice(i, 1);
			}
		}
	}

	function unique(array) {
		var n = -1;

		while (++n < array.length) {
			remove(array, array[n], n);
		}

		return array;
	}

	mixin.array = {
		filter:  Array.prototype.filter,
		map:     Array.prototype.map,
		reduce:  Array.prototype.reduce,
		push:    Array.prototype.push,
		concat:  Array.prototype.concat,
		sort:    Array.prototype.sort,
		splice:  Array.prototype.splice,
		some:    Array.prototype.some,
		indexOf: Array.prototype.indexOf,
		forEach: Array.prototype.forEach,

		each: function each() {
			Array.prototype.forEach.apply(this, arguments);
			return this;
		},

		add: function(obj) {
			if (this.indexOf(obj) !== -1) { return; }
			this.push(obj);
			return this;
		},

		remove: function(obj) {
			remove(this, obj);
			return this;
		},

		unique: function() {
			unique(this);
			return this;
		},

		intersect: function(array) {
			var n = -1;
			var l = this.length;
			var intersection = [];

			while (++n < l) {
				if (array.indexOf(this[n]) !== -1) {
					intersection.push(this[n]);
				}
			}

			return unique(intersection);
		},

		unite: function(array) {
			return unique(this.concat(array));
		},

		diff: function(array) {
			var n = -1;
			var l = this.length;
			var difference = array.slice();

			while (++n < l) {
				if (array.indexOf(this[n]) === -1) {
					difference.push(this[n]);
				}
				else {
					remove(difference, this[n]);
				}
			}

			return unique(difference);
		},

		length: 0
	};
})(this);