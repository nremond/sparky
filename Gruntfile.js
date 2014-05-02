module.exports = function(grunt) {
	grunt.initConfig({
		concat: {
			'js/sparky.js': [
				'src/window.requestanimationframe.js',
				'src/mixin.array.js',
				'src/mixin.events.js',
				'src/observe.js',
				'src/collection.js',
				'src/sparky.js',
				'src/sparky.bind.js',
				'src/sparky.filters.js',
				'src/sparky.ready.js'
			]
		},

		uglify: {
			'js/sparky.min.js': ['js/sparky.js']
		}
	});

	// Load Our Plugins
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	// Register Default Task
	grunt.registerTask('default', ['concat', 'uglify']);
};
