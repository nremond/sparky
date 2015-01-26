
// Collection()

(function(ns, mixin, undefined) {
	"use strict";

	var debug = false;
	var defaults = {
	    	index: 'id'
	    };

	function isDefined(val) {
		return val !== undefined && val !== null;
	}

	// Map functions

	function returnArg(arg) {
		return arg;
	}

	// Each functions

	function setValue(value, i) {
		this[i] = value;
	}

	function setListeners(data, i) {
		if (!sub.on) { return; }

		//sub
		//.on('change', this.trigger)
		//.on('destroy', this.remove);
	}

	// Sort functions

	function byGreater(a, b) {
		return a > b ? 1 : -1 ;
	}

	function byId(a, b) {
		return a.id > b.id ? 1 : -1 ;
	}

	// Object functions

	function extend(obj) {
		var i = 0,
		    length = arguments.length,
		    obj2, key;

		while (++i < length) {
			obj2 = arguments[i];

			for (key in obj2) {
				if (obj2.hasOwnProperty(key)) {
					obj[key] = obj2[key];
				}
			}
		}

		return obj;
	}

	// Collection functions

	function findByIndex(collection, id) {
		var index = collection.index;
		var n = -1;
		var l = collection.length;

		while (++n < l) {
			if (collection[n][index] === id) {
				return collection[n];
			}
		}
	}

	function findByObject(collection, query) {
		var i = collection.indexOf(query);

		// query IS the object in the collection. Fast out.
		if (i > -1) { return query; }

		// object has one property, index. Find by index.
		return findByIndex(collection, query[collection.index]);
	}

	function queryByObject(collection, query) {
		var keys = Object.keys(query);

		// Match properties of query against objects in the collection.
		return keys.length === 0 ?
			collection.slice() :
			collection.filter(function(object) {
				var k = keys.length;
				var key;

				while (k--) {
					key = keys[k];
					if (object[key] !== query[key]) {
						return false;
					}
				}

				return true;
			}) ;
	}

	function add(collection, object) {
		// Add an item, keeping the collection sorted by id.
		var index = collection.index;

		// If the object does not have an index key, push it
		// to the end of the collection.
		if (!isDefined(object[index])) {
			collection.push(object);
			return;
		}

		var l = collection.length;

		while (collection[--l] && (collection[l][index] > object[index] || !isDefined(collection[l][index])));
		collection.splice(l + 1, 0, object);
	}

	function remove(collection, obj, i) {
		var found;

		if (i === undefined) { i = -1; }

		while (++i < collection.length) {
			if (obj === collection[i]) {
				collection.splice(i, 1);
				--i;
				found = true;
			}
		}

		return found;
	}

	function invalidateCaches(collection) {

	}

	function toJSON(collection) {
		return collection.map(toArray);
	}

	function multiarg(fn1, fn2) {
		return function distributeArgs(object) {
			invalidateCaches(this);

			if (object === undefined) {
				if (fn2) { fn2.apply(this); }
				return this;
			}

			var n = -1;
			var l = arguments.length;

			while (++n < l) {
				fn1.call(this, arguments[n]);
			}

			return this;
		}
	}


	mixin.collection = {
		add: multiarg(function(item) {
			add(this, item);
			this.trigger('add', item);
		}),

		remove: multiarg(function(item) {
			var object = this.find(item);
			if (!object) { return; }
			remove(this, object);
		}, function() {
			// If item is undefined, remove all objects from the collection.
			var n = this.length;
			var object;

			while (n--) { this.pop(); }
		}),

		push: function push() {
			var l = arguments.length;
			var n = -1;

			Array.prototype.push.apply(this, arguments);
			while (++n < l) {
				this.trigger('add', arguments[n]);
			}

			return this;
		},

		pop: function pop() {
			var i = this.length - 1;
			var object = this[i];
			this.length = i;
			this.trigger('remove', object, i);
			return object;
		},

		splice: function splice(i, n) {
			var removed = Array.prototype.splice.apply(this, arguments);
			var r = removed.length;
			var added = Array.prototype.slice.call(arguments, 2);
			var l = added.length;
			var a = -1;

			while (r--) {
				this.trigger('remove', removed[r], i + r);
			}

			while (++a < l) {
				this.trigger('add', added[a], a);
			}

			return removed;
		},

		update: multiarg(function(obj) {
			var item = this.find(obj);

			if (item) {
				extend(item, obj);
				this.trigger('update', item);
			}
			else {
				this.add(obj);
				this.trigger('add', obj);
			}

			return this;
		}),

		find: function find(object) {
			var index = this.index;

			// find() returns the first object with matching key in the collection.
			return arguments.length === 0 ?
					undefined :
				typeof object === 'string' || typeof object === 'number' || object === undefined ?
					findByIndex(this, object) :
					findByObject(this, object) ;
		},

		query: function query(object) {
			// query() is gauranteed to return an array.
			return object ?
				queryByObject(this, object) :
				[] ;
		},

		contains: function contains(object) {
			return this.indexOf(object) !== -1;
		},

		// Get the value of a property of all the objects in
		// the collection if they all have the same value.
		// Otherwise return undefined.

		get: function get(property) {
			var n = this.length;

			if (n === 0) { return; }

			while (--n) {
				if (this[n][property] !== this[n - 1][property]) { return; }
			}

			return this[n][property];
		},

		// Set a property on every object in the collection.

		set: function set(property, value) {
			if (arguments.length !== 2) {
				throw new Error('Collection.set(property, value) requires 2 arguments. ' + arguments.length + ' given.');
			}

			var n = this.length;
			while (n--) { this[n][property] = value; }
			return this;
		},

		toJSON: function toJSON() {
			return this.map(returnArg);
		},

		toObject: function toObject(key) {
			var object = {};
			var prop, type;

			if (!key) { key = this.index; }

			while (n--) {
				prop = this[n][key];
				type = typeof prop;

				if (type === 'string' || type === 'number' && prop > -Infinity && prop < Infinity) {
					object[prop] = this[n];
				}
				else {
					console.warn('Collection.toObject() ' + prop + ' cannot be used as a key.');
				}
			}

			return object;
		}
	};

	// Object constructor

	var prototype = extend({}, mixin.events, mixin.set, mixin.array, mixin.collection);
	
	var properties = {
		length: {
			value: 0,
			enumerable: false,
			writable: true,
			configurable: true
		}
	};

	function Collection(data, options) {
		var settings = extend({}, defaults, options);
		var collection = Object.create(prototype, properties);

		function byIndex(a, b) {
			return a[settings.index] > b[settings.index] ? 1 : -1 ;
		}

		Object.defineProperties(collection, {
			// Define the name of the property that will be used to sort and
			// index this collection.
			index: { value: settings.index }
		});

		if (data === undefined) {
			data = [];
		}
		else if (!(data instanceof Array)) {
			if (debug) console.log('Scribe: data not an array. Scribe cant do that yet.');
			data = [];
		}

		// Populate the collection
		data.forEach(setValue, collection);

		// Sort the collection
		collection.sort(byIndex);

		var length = collection.length = data.length;

		function observeLength(collection) {
			var object;

			while (length-- > collection.length) {
				// According to V8 optimisations, setting undefined is quicker
				// than delete.
				collection[length] = undefined;
			}

			length = collection.length;
		}

		// Watch the length and delete indexes when the length becomes shorter
		// like a nice array does.
		observe(collection, 'length', observeLength);

		// Delegate events
		//collection
		//.each(setListeners);

		// Define caches
		//Object.defineProperties(collection, {
		//
		//});

		return collection;
	};

	Collection.prototype = prototype;
	Collection.add = add;
	Collection.remove = remove;
	Collection.isCollection = function(object) {
		return Collection.prototype.isPrototypeOf(object);
	};

	ns.Collection = Collection;
})(this, this.mixin);
