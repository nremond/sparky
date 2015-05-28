<h1>Sparky</h1>

![alt tag](https://raw.githubusercontent.com/cruncher/sparky/master/images/sparky-logo.png)

<strong>Sparky is a flexible, model-agnostic live data binding view/controller
layer for HTML/JS. Sparky enhances the DOM with declarative data bindings,
passes data through Django-style template filters and renders multiple changes
in batches on browser frames for performance.</strong>

## Quick start

Sparky wires up the DOM automatically on <code>load</code>. He binds nodes with
a <code>data-scope</code> attribute to model objects stored in
<code>Sparky.data</code>, and passes nodes with a <code>data-ctrl</code>
attribute to controller functions stored in <code>Sparky.ctrl</code>.

HTML:

    <div class="{{type}}-block" data-scope="my-data">
        <input type="text" name="{{title}}" />
        <p>{{title|uppercase}} loves you!</p>
    </div>

JS:

    Sparky.data['my-data'] = {
        title: 'Sparky',
        type: 'user'
    };

Here a Sparky template is live bound to the properties of <code>my-data</code>.
The result is:

    <div class="user-block" data-scope="my-data">
        <input type="text" name="{{title}}" value="Sparky" />
        <p>SPARKY loves you!</p>
    </div>

Live binding means that when the data changes, the DOM is kept up-to-date.
Inputs get two-way binding. Typing text into the input updates 
<code>my-data.title</code>, and thus also the text in the paragraph.

Sparky defaults to using models directly as scope for rendering templates,
making it quick and easy to set up basic views for an app. Where more control is
needed, a controller function can be used to return an alternative object to be
used as scope.

HTML:

    <div class="{{type}}-block" data-scope="my-data" data-ctrl="my-ctrl">
        <input type="text" name="{{title}}" />
        <p>{{title}} loves you!</p>
    </div>

JS:

    Sparky.ctrl['my-ctrl'] = function(node, model) {
        var scope = {
            title: model.title,
            type: model.type
        };

        // Do something with the node and/or model

        // Return the scope object Sparky should use to
        // render the node.
        return scope;
    };

Sparky does not make scope objects for you, you create them where you need them.
The controller function is passed the node, and a model where
<code>data-scope</code> is given. If the function returns
<code>undefined</code>, the scope defaults to the model.

Either or both <code>data-scope</code> and <code>data-ctrl</code> can be defined
for Sparky to template a node.

It is not required to store data models in <code>Sparky.data</code> and
controllers in <code>Sparky.ctrl</code>, nor to declare them in the DOM – a node
can also be bound to a model object via a controller function by calling
<code>Sparky(node, model, controller)</code>. Both the model and the controller
are optional.

## Sparky templates

#### The data-ctrl attribute

The <code>data-ctrl</code> attribute defines which controller(s) to run when
sparky binds this element.

    <form data-ctrl="validate-on-submit">{{day}}</form>

You can find controllers by logging <code>Sparky.ctrl</code>.

Controllers are simply functions that are called when Sparky scans this node.

    Sparky.ctrl['validate-on-submit'] = function validateCtrl(node, scope) {
        node.addEventListener('submit', function(e) {
            // TODO: Validate the form node
            e.preventDefault();
        });
    };

The return value of the controller is used as scope for the template to bind
to, unless that value is <code>undefined</code>, in which case scope defaults
to the current scope.

More than one controller can be defined. They are run in order. The return value
of one controller is passed to the next as the <code>scope</code> argument.

    <form data-ctrl="my-app-scope validate-on-submit">
        <input type="range" name="{{volume}}" min="0" max="11" data-ctrl="value-number-pow-3" />
        <output>{{volume|decibels}}dB</output>
    </form>

<a href="#define-a-controller-function">Define a controller function</a>.

#### The data-scope attribute

The <code>data-scope</code> attribute describes a path to an object in the
current scope to use as scope to render this node, in dot notation.

    <div data-scope="{{path.to.object}}">
        <h1>{{title}}</h1>
    </div>

Without the <code>{{}}</code> brackets, <code>data-scope</code> is a path
to an object in <code>Sparky.data</code>.

    Sparky.data['my-app'] = {
        author: { name: 'Nigel' }
    };

    <div data-scope="my-app.author">
        <h1>{{name}}</h1>
    </div>

It's ok to write paths that have an '-' in their property names.

If <code>data-ctrl</code> is defined the scope is passed to a controller.

Where <code>data-scope</code> resolves to an array or array-like object such as
a <code>Sparky.Collection()</code>, the node is cloned for each item in the
collection and controllers called on each new node.

#### {{tag}}

Sparky template tags will look familiar to anyone who has written a Django
template. Sparky tags, however, perform live data binding.

    <h1 data-scope="my-model">{{ title }}</h1>

The text in the <code>&lt;h1&gt;</code> is now updated whenever
<code>my-model.title</code> changes.

Tags also grok paths:

    <h1 data-scope="my-model" class="words-{{path-to.meta.word-count}}">{{title}}</h1>

Sparky treats tags in the <code>class</code> attribute as individual tokens: it
is safe to modify the <code>class</code> attribute outside of Sparky, as Sparky
avoids overwriting any new classes that have been added.

#### {{tag|filter}}

Modify scope values with filters:

    <h1 data-scope="my-model" class="{{selected|yesno:'active','inactive'}}">
        {{title|uppercase}}
    </h1>

More about <a href="#sparky-template-filters">filters</a>.

#### {{{tag}}}

A triple bracket tag updates from the scope once only.

    <h1 data-scope="my-model">{{{ title }}}</h1>

These tags are updated once from the scope (in this case my-model), but they
don't live bind to changes. If you know where you can do it, this can be good
for performance.

#### input, select and textarea elements

By putting a Sparky tag in the <code>name</code> attribute, inputs, selects and
textareas get 2-way data binding. When the scope changes, their values are
updated, and when their values are changed, the scope is updated.

    <form class="user-form" data-scope="my-model">
        <input type="text" name="{{title}}" value="" />
    </form>

By default Sparky is strict about type in form elements. The input above is
<code>type="text"</code> and it will only get the <code>title</code> property
if it is a string. Other types will display as an empty string.

    model.title = 'Sparky loves you'; // input.value is 'Sparky loves you'
    model.title = 3;                  // input.value is ''

Similarly, <code>type="number"</code> and <code>type="range"</code> will only
get and set numbers, and if the value attribute is not given
<code>type="checkbox"</code> will only get and set <code>true</code> or
<code>false</code>. (If the value attribute is given, the property must be a
string matching the value attribute for the checkbox to be checked).

To get and set other types, give the element one of Sparky's value controllers:

- <code>value-string</code> gets and sets strings
- <code>value-number</code> gets and sets numbers
- <code>value-integer</code> gets and sets integer numbers, rounding if necessary
- <code>value-boolean</code> gets and sets <code>true</code> or <code>false</code>
- <code>value-number-inverted</code> gets and sets numbers, inverting the range between max and min
- <code>value-boolean-inverted</code> gets and sets <code>true</code> or <code>false</code>, inverting the state of the input
- <code>value-any</code> gets any type, sets strings

Here are some examples. Radio inputs that sets scope.property to <code>1</code> or <code>2</code>:

    <input type="radio" data-ctrl="value-number" name="{{property}}" value="1" />
    <input type="radio" data-ctrl="value-number" name="{{property}}" value="2" />

A select that sets scope.property to <code>true</code> or <code>false</code>:

    <select data-ctrl="value-boolean" name="{{property}}">
        <option value="true">Yes</option>
        <option value="false">No</option>
    </select>

A checkbox that is checked when <code>scope.property === 3</code>:

    <input type="checkbox" data-ctrl="value-number" name="{{property}}" value="3" />

A range slider that sets scope.property as a string:

    <input type="range" data-ctrl="value-string" name="{{property}}" min="0" max="1" step="any" />

#### attributes

Sparky looks for tags in text nodes and the following attributes:

- <code>href</code>
- <code>title</code>
- <code>id</code>
- <code>style</code>
- <code>src</code>
- <code>alt</code>

You can change the list by modifying the array <code>Sparky.attributes</code>.

inputs, selects and textareas also use:

- <code>name</code>
- <code>value</code>
- <code>max</code>
- <code>min</code>

They're a bit special. They get two-way data binding.

#### Loop over a collection

Sparky has no special syntax for looping over a collection, but where
<code>data-scope</code> resolves to an array or array-like object
Sparky automatically loops over it, cloning the corresponding DOM node for all
the items in the collection. So this...

    <ul>
        <li data-scope="contributors">
            <a href="{{url}}">{{name}}</a>
        </li>
    </ul>

    Sparky.data.contributors = Sparky.Collection([
        { name: "Sparky",   url: "http://github.com/cruncher/sparky" },
        { name: "Cruncher", url: "http://cruncher.ch" }
    ]);

...results in a DOM that looks like this<a href="#-note">*<sup>note</note></a>:

    <ul>
        <li>
            <a href="http://github.com/cruncher/sparky">Sparky</a>
        </li>
        <li>
            <a href="http://cruncher.ch">Marco</a>
        </li>
    </ul>

## Sparky API

#### Define a controller function

Controllers are stored in <code>Sparky.ctrl</code>. A controller is a function
that is run just before sparky data-binds the node. The return value of the
controller is used as scope to update the tags in the sparky template. In Sparky
scope objects are just plain objects you create.

    Sparky.ctrl['my-ctrl-1'] = function(node, model) {
        var scope = { day: 'unknown'; };

        // Listen for changes on a model
        Sparky.observe(model, 'date', function() {
            if (model.date === '2014-12-25') {
                // Update the scope
                scope.day = 'Christmas!';
            }
        });

        return scope;
    };

Where the <code>ctrl</code> function returns <code>undefined</code>, Sparky uses
the model as scope.

Controllers are called with a <code>sparky</code> object as their context
<code>this</code>. It's common to listen to lifecycle events inside a
controller:

    Sparky.ctrl['my-ctrl-2'] = function myCtrl2(node, model) {
        var scope = { day: 'unknown'; };
        
        this.on('ready', function() {
            // The node has bound and has been populated with any
            // existing model data.
        });
        
        this.on('insert', function() {
            // The node has been inserted into the DOM.
        });
        
        this.on('destroy', function() {
            // The node has been unbound from the model and
            // removed from the DOM
        });

        return scope;
    };

Where multiple controllers are defined in <code>data-ctrl</code> they are all
called with the same <code>sparky</code> object as context.

#### Define a model object

Models are stored in <code>Sparky.data</code>. A model is an object that Sparky
watches for changes.

    Sparky.data['my-model'] = {
        date: new Date()
    };

Sparky is agnostic about how you structure your apps. How you structure
your data models is how you control the paths used in your templates.
Store your models in <code>Sparky.data</code> to give them to Sparky templates
bound on DOM load, or bind them yourself with <code>Sparky(node, model, ctrl)</code>. 

#### Sparky(node, model, ctrl)

To bind a node in JS, call <code>Sparky(node, model, ctrl)</code>.

##### parameters

<code>node</code>: DOM node | document fragment | string

A string defines the <code>id</code> of a <code>&lt;template&gt;</code>.
<code>node</code> is a required parameter.

<code>model</code>: object | string | undefined

A string defines a path to an object in <code>Sparky.data</code> using dot
notation.

<code>ctrl</code>: function | string | undefined

A string defines a name, or a space-separated list of names of ctrl functions
stored in <code>Sparky.ctrl</code>. Controller functions are called with
<code>(node, model)</code>.

##### return value

<code>sparky</code>: sparky object

Used to listen to lifecycle events and can be used to communicate with controllers.

### The sparky object

A sparky object is an array-like object of DOM nodes that have been bound to
data models. It also emits lifecycle events and exposes a few methods for
interacting with the template.

#### Events

- <code>ready</code>: triggered after Sparky first updates the node
- <code>insert</code>: triggered when the node is inserted into the DOM (CURRENTLY UNRELIABLE)
- <code>destroy</code>: triggered when the node has been unbound from the model
and removed from the DOM

#### Methods

- <code>.destroy()</code> Unbind all of this sparky's nodes from data models.

## Manipulating bound nodes in the DOM

Sparky templates are reasonably tolerant to being manipulated in the DOM.
Nodes in a template will stay bound to models when they are moved around or
removed from the DOM, or even when other nodes are inserted between them.

Because <code>sparky</code> is an array-like object, and jQuery accepts node
arrays, one easy way of manipulating its nodes is simply to wrap it in
jQuery, allowing you to use jQuery's API to move the templated nodes around:

    jQuery(sparky).appendTo(document.body);

You should be aware, though, that trying to manipulate text content or
attributes that had Sparky tags in them when they were bound will likely cause
problems – with the exception of the <code>class</code> attribute: you can add
and remove your own classes as much as you like without fear of upsetting
Sparky.

## Sparky functions

#### Sparky.Collection(array, options)

Returns an array-like object with a number of methods for managing a collection.

    var collection = Sparky.Collection();

##### collection.add(object)
##### collection.update(object)
##### collection.remove()

<code>.remove()</code> Removes all objects from the collection.
<code>.remove(id)</code> Removes object found via <code>collection.find(id)</code> from the collection.
<code>.remove(object)</code> Removes object found via <code>collection.find(object)</code> from the collection.

##### collection.find()

<code>.find(id)</code> returns the object in the collection with that id, or <code>undefined</code>.
<code>.find(object)</code> returns <code>object</code> if it is already in the collection. Otherwise if <code>object</code> has an <code>id</code>, that is used to <code>.find(id)</code> an object.

##### collection.query(queryObject)

Filters the collection by the properties of <code>queryObject</code>

##### collection.sort()

<code>.sort()</code> sorts the collection by <code>object.id</code>.
<code>.sort(fn)</code> sorts the collection by the return value of <code>fn</code>, like <code>array.sort(fn)</code>.

##### collection.sub(queryObject)

Creates a new collection that is bound to the current one, but filtered by <code>queryObject</code>.

##### collection.get(name)

If they all have the same value, returns value of property <code>name</code> of the objects in the collection. Otherwise returns <code>undefined</code>.

##### collection.set(name, value)

Sets property <code>name</code> of all objects in the collection to <code>value</code>.

##### collection.on()
##### collection.off()
##### collection.trigger()
##### collection.push()
##### collection.pop()
##### collection.splice()

Also, a Collection inherits the Array methods:

- <code>.map()</code>
- <code>.reduce()</code>
- <code>.concat()</code>
- <code>.slice()</code>
- <code>.some()</code>
- <code>.indexOf()</code>
- <code>.forEach()</code>


#### Sparky.Throttle(fn)

Takes one function and returns a function that throttles calls to the browser
frame rate.

    var throttle = Sparky.Throttle(fn);

Calling <code>throttle()</code> causes <code>fn</code> to be called on the next
browser frame. Multiple calls to <code>throttle()</code> result in just one call
to <code>fn</code> on the next frame. <code>fn</code> is called with the
arguments from the latest call to <code>throttle(arg1, arg2, ...)</code>.

#### Sparky.extend(object1, object2, ... )

#### Sparky.observe(object, property, fn)

#### Sparky.unobserve(object, property, fn)

#### Sparky.observePath(object, path, fn)

#### Sparky.observePathOnce(object, path, fn)

#### Sparky.unobservePath(object, path, fn)

#### Sparky.get(object, path)

Gets value from <code>'path.to.value'</code> inside <code>object</code>.

    var object = { path: { to: { value: 3 }}};
    var value = Sparky.getPath(object, 'path.to.value')  // Returns 3

If any object in the path does not exist, <code>getPath</code> returns <code>undefined</code>

#### Sparky.set(object, path, value)

#### Sparky.template(id)

Given the id of a template tag in the DOM, <code>Sparky.template(id)</code>
returns the cloned contents of that template as a document fragment.

Supports browsers where <code>&lt;template&gt;</code> does not have the
associated JavaScript property <code>template.content</code>.

## Sparky template filters

Display the date, formatted:

    <h1 class="language-{{lang}}" data-scope="text">
        {{title}}
        <time>{{date|date:'d M Y'}}</time>
    </h1>

Sparky has a number of template filters for modifying and formatting data. You
can also create your own. Sparky template filter syntax is similar to
<a href="http://docs.django.com/templates">Django template</a> filter syntax:

    <p>{{ date|date:'d M Y' }}</p>

Sparky has a subset of the Django filters:

- add
- capfirst
- cut
- date
- default
- escape
- first
- floatformat: number
- join
- json
- last
- length
- linebreaksbr
- lower
- multiply: number
- parseint
- pluralize: 
- random
- replace
- safe
- slice
- slugify
- striptags
- striptagsexcept
- time
- truncatechars
- unordered_list
- yesno

And some of it's own:

- decibels: number – Takes a number as a ratio of powers and performs 20log10(number) to render it on the decibel scale. Useful when working with WebAudio parameters.
- decimals – Alias of floatformat.
- get:'propertyName' – Takes an object and renders the named property.
- lowercase – Alias of lower.
- percent – Takes a number and multiplies by 100 to render it as a percentage.
- prepad: n, 'character' – 
- postpad: n, 'character' – 
- symbolise – Converts common values to symbolic equivalents: JavaScript's number Infinity becomes '∞'.

## Notes

#### Using Sparky with Django

If you do happen to be using Django, Sparky's template tags will clash with
Django's. To avoid Sparky templates being read by Django, wrap them in Django's
<code>{% verbatim %}</code> tag:

    {% verbatim %}
    <h1 class="language-{{lang}}" data-scope="text">
        {{title}}
        <time>{{date|date:'d M Y'}}</time>
    </h1>
    {% endverbatim %}

#### <a href="#loop-over-a-collection">* note</a>

It actually looks like this:

    <ul>
        <li>
            <a href="http://github.com/cruncher/sparky">Sparky</a>
        </li>
        <li>
            <a href="http://cruncher.ch">Marco</a>
        </li>
        <!-- [Sparky] data-scope="text.meta.contributors" -->
    </ul>

The comment node is added automatically and is required by Sparky to maintain
the collection. This technique is nicked from AngularJS.

## Sparky says thankwoo

to Mariana Alt (<a href="http://www.alt-design.ch/">www.alt-design.ch</a>) for drawing me for my logo.


<!--#### Sparky.observe(object, property, fn);

Sparky.observe observes changes to the property of an object by
reconfiguring it as a getter/setter. This is very fast but has a
limitation or two.

Sparky.observe can't listen for changes to the length of an array,
as arrays don't allow the length property to be configured. But it
can listen for changes to the length of a collection object:

    var collection = Sparky.Collection(array);

(Sparky can handle arrays, but uses dirty checking internally to observe
the length. You get better performance from a collection object.)

#### Sparky.unobserve(object, property, fn);

Unbind an observer fn from the object property.

#### Adapt Sparky to your data models

If you want to use a different means of observing changes to data,
overwrite Sparky.observe and Sparky.unobserve with your own functions.
Say your models emit events, and you bind to them with .on() and .off()
methods:

   Sparky.observe = function(object, property, fn) {
       object.on(property, fn);
   };

Don't forget the unobserver:

   Sparky.unobserve = function(object, property, fn) {
       object.off(property, fn);
   }
-->

