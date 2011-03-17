MixpanelAPI
===========

Queries the [Mixpanel Data API](http://mixpanel.com/api/docs/guides/api/v2). Requires node 0.4.0 or higher.

Installation
============

`npm install mixpanel`

Show me the code
================

Note: this was forked from the CoffeScript implementation done by Campfire Labs.
mixpanel = require('mixpanel')

var api_key = 'YOUR API KEY',
	api_secret = 'YOUR API SECRET';

var mx = new mixpanel({
	api_key: api_key,
	api_secret: api_secret
});

mx.request(
	'button click',
	{
		type: 'unique',
		interval: 7,
		unit: 'day'
	},
	function(error, data) {
		console.dir(data);
	}
		
)
