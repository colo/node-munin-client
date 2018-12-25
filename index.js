'use strict'

let debug = require('debug')('node-munin-client');
let debug_events = require('debug')('node-munin-client:Events');
let debug_internals = require('debug')('node-munin-client:Internals');


let net = require('net'),
		mootools = require('mootools');

module.exports = new Class({
	Implements: [Options, Events],

	//buffer: [],

	methods: [
		//Lists the capabilities of the node, e.g. multigraph dirtyconfig
		'cap',
		// list [node] - Simply lists items available for gathering for this host. E.g. load, cpu, memory, df, et alia. If no host is given, default to host that runs the munin-node.
		'list',
		//Lists hosts available on this node.
		'nodes',
		//config <query-item> - Shows the plugins configuration items. See the config protocol for a full description.
		'config',
		//fetch <query-item> - Fetches values
		'fetch',
		//Print version string
		'version',
		//Close the connection. Also possible to use a point “.”.
		'quit'
	],

	options : {
		host: '127.0.0.1',
		port: 4949,
		//buffer: {
			//size: 5,
		//}
	},

	initialize: function(options){
		this.setOptions(options);

		Array.each(this.methods, function(method){

			this[method] = function(){
				//console.log(typeof(arguments));
				//console.log('---callback---', arguments);

				let arg = '';
				let callback = '';
				if(arguments.length > 1){
					arg = ' '+arguments[0];
					callback = arguments[1];
				}
				else{
					callback = arguments[0];
				}

				let client = net.connect(
					this.options.port,
					this.options.host,
					function() { //'connect' listener
						client.write(method+arg+'\n');
					}
				);



				let result = '';
				client.on('data', function (data) {

					data.toString().split('\n').forEach(function (str) {
						// ignore empty lines, BANNER and '.' (end of some commands)
						if (str !== "" && str.charAt(0) != '#' && str != '.') {
							result +=str+'\n';
						}

					}.bind(this));

					client.end();
				}.bind(this));

				//timeout

				client.on('end', function() {
					//console.log('--end---');
					//console.log(result);

					if(result == '' && method != 'quit'){//quit method will always end with no data
						callback(new Error('Conection end with no data.'), null);
					}
					else{
						this.send_data(method, result, callback);
					}
				}.bind(this));

				client.on('close', function(err) {
					//console.log('--close---', err);

				});
				client.on('error', function(err) {
					//console.log('--error---', err);
					callback(err, null);
				});

			};//end declaration on ->method

		}.bind(this));
	},
	send_data(cmd, data, callback){
		data = data.trim();

		let result = {}
		let lines = ''

		switch (cmd) {
				case 'banner':
					// ignore the banner
					break;

				case 'cap':
					throw new Error('TODO: cap');
					break;

				case 'quit':
					callback(null, true);
					break;

				case 'list':
					// split the list on space, return array
					let list = data.trim().split(' ');
					callback(null, list);
					break;

				case 'config':
					//console.log('data', data);
					// let result = {};
					lines = data.split('\n');

					Array.each(lines, function(line){
						let space = line.indexOf(' ');
						let title = line.substring(0, space);
						let value = line.substr(space + 1);
						if(!isNaN(value * 1))
							value *= 1

						let keys = [];
						if(title.indexOf('.') >= 0){
							keys = title.split('.', 2);
						}
						else if(title.indexOf('_') >= 0){
							keys = title.split('_', 2);
						}
						else{
							keys[0] = title;
						}

						if(!result[keys[0]])
							result[keys[0]] = {};

						if(keys.length == 1){
							result[keys[0]] = value;
						}
						else{
							result[keys[0]][keys[1]] = value;
						}

					});

					callback(null, result);

					break;

				case 'fetch':
					//console.log('data', data);
					// let result = {};
					lines = data.split('\n');

					Array.each(lines, function(line){
						let parts = line.split(' ');
						//console.log('parts', parts);

						let name = parts[0].split('.');
						if (name[1] == 'value') {
							// if foo.value, all we really want is foo
							name = name[0];
						} else {
							// but if we get not-.value for some reason, keep it all
							name = parts[0];
						}

						if(!isNaN(parts[1] * 1))
							parts[1] *= 1

						result[name] = parts[1];
					});

					debug_internals('fetch', result)

					callback(null, result);

					break;

				case 'nodes':
					//console.log('data', data);
					result = data.split('\n');
					callback(null, result);
					break;

				case 'version':
					//console.log('data', data);
					// expect munins node on fkops02.prod.fictivevpn.com version: 1.4.5
					let matches = data.match(/^munins node on (.*?) version: (.*)$/);
					if(matches != null){
						callback(null, {node: matches[1], version: matches[2]});
					}
					else{
						callback(new Error('Bad version returned.'), data);
					}

					break;

			}
	}

});
