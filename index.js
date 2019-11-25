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
		cap: {
			multigraph: true
		},
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
						if(method === 'list' && this.options.cap.multigraph === true){
							client.write('cap multigraph\n');
						}
						client.write(method+arg+'\n');
					}.bind(this)
				);



				let result = '';
				let multi = /^cap\b.*/
				client.on('data', function (data) {

					data.toString().split('\n').forEach(function (str) {
						// ignore empty lines, BANNER and '.' (end of some commands)
						if (str !== "" && str.charAt(0) != '#' && str != '.' && (this.options.cap.multigraph !== true || !multi.test(str))) {
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
		let multigraph_key
		let tmp_result = {}


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
					multigraph_key = undefined

					Array.each(lines, function(line){
						let space = line.indexOf(' ');
						let title = line.substring(0, space);
						let value = line.substr(space + 1);
						if(!isNaN(value * 1))
							value *= 1

						let keys = [];
						if(title.indexOf('.') > -1){
							keys = title.split('.', 2);
						}
						else if(title.indexOf('_') > -1){
							keys = title.split('_', 2);
						}
						else{
							keys[0] = title;
						}

						/**
						* result: { graph: { args: '--base 1024 -l 0 --upper-limit 4143013888', vlabel: 'Bytes', title: 'Memory usage', category: 'system', info: 'This graph shows what the machine uses memory for.', order: 'apps page_tables swap_cache slab cached buffers free swap ' }, apps: { label: 'apps', draw: 'AREA', info: 'Memory used by user-space applications.' }, buffers: { label: 'buffers', draw: 'STACK', info: 'Block device (e.g. harddisk) cache. Also where "dirty" blocks are stored until written.' }, swap: { label: 'swap', draw: 'STACK', info: 'Swap space used.' }, cached: { label: 'cache', draw: 'STACK', info: 'Parked file data (file content) cache.' }, free: { label: 'unused', draw: 'STACK', info: 'Wasted memory. Memory that is not used for anything at all.' }, slab: { label: 'slab_cache', draw: 'STACK', info: 'Memory used by the kernel (major users  are caches like inode, dentry, etc).' }, swap_cache: { label: 'swap_cache', draw: 'STACK', info: 'A piece of memory that keeps track of pages that have been fetched from swap but not yet been modified.' }, page_tables: { label: 'page_tables', draw: 'STACK', info: 'Memory used to map between virtual and physical memory addresses.' }, vmalloc_used: { label: 'vmalloc_used', draw: 'LINE2', info: '\'VMalloc\' (kernel) memory used' }, committed: { label: 'committed', draw: 'LINE2', info: 'The amount of memory allocated to programs. Overcommitting is normal, but may indicate memory leaks.' }, mapped: { label: 'mapped', draw: 'LINE2', info: 'All mmap()ed pages.' }, '': 'active' }
						* keys: [ '', 'label' ]
						* value: 'active'
						* fix this error, keys shouldn't be empty strings
						**/
						keys = keys.erase('')
						keys = keys.clean()

						if(keys[0] === 'multigraph'){
							// console.log('---->' + keys[1])
							// console.log('---->' + value)
							// process.exit(1)


							multigraph_key = value

							if(!tmp_result['multigraph']) tmp_result['multigraph'] = {}

							tmp_result['multigraph'][value] = {}
						}
						else if(multigraph_key){
							// tmp_result[multigraph_key][name] = parts[1];

							if(!tmp_result['multigraph'][multigraph_key][keys[0]])
								tmp_result['multigraph'][multigraph_key][keys[0]] = {};

							if(keys.length == 1){
								tmp_result['multigraph'][multigraph_key][keys[0]] = value;
							}
							else{
								tmp_result['multigraph'][multigraph_key][keys[0]][keys[1]] = value;
							}

						}
						else{

							if(!result[keys[0]])
								result[keys[0]] = {};

							if(keys.length == 1){
								result[keys[0]] = value;
							}
							else{
								debug_internals('error %o %o %o', result, keys, value)

								result[keys[0]][keys[1]] = value;
							}

						}



					});

					if(Object.getLength(tmp_result) > 0){
						result = tmp_result
					}

					callback(null, result);

					break;

				case 'fetch':
					//console.log('data', data);
					// let result = {};
					lines = data.split('\n');
					multigraph_key = undefined

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

						if(name === 'multigraph'){
							multigraph_key = parts[1]
							if(!tmp_result['multigraph']) tmp_result['multigraph'] = {}

							tmp_result['multigraph'][parts[1]] = {}
						}
						else if(multigraph_key){
							tmp_result['multigraph'][multigraph_key][name] = parts[1];
						}
						else{
							result[name] = parts[1];
						}
					});

					if(Object.getLength(tmp_result) > 0){
						result = tmp_result
					}

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
