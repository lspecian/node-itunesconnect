//! itc-report.js
//! version : 0.0.1
//! authors : Marek Serafin
//! license : MIT
//! github.com/stoprocent/itc-report

var async 	= require('async');
	request = require('request'),
	cheerio = require('cheerio'),
	moment  = require('moment'),
	fs 		= require('fs'),
	path 	= require('path'),
	_ 		= require('underscore');

/**
* @module itc-report
*/

/*
* Expose `iTunesConnect`
*/

exports = module.exports = iTunesConnect;

/*
* Expose `ReportQuery`.
*/

exports.ReportQuery = ReportQuery;

/**
* Static constants to make it easier to build query
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*		Constants 		= iTunesConnect.Constants;
*
*	// Possible Types 
*	Constants.InApp // In-App Purchases
*	Constants.App // App Purchases
*
*	// Possible Transactions 
*	Constants.Free
*	Constants.Paid 
*	Constants.Redownload
*	Constants.Update
*	Constants.Refund 
*
* 	// Possible Platforms
*	Constants.Desktop
*	Constants.iPhone 
*	Constants.iPad 
*	Constants.iPod
*
*	// Possible Measures
*	Constants.Proceeds // How much moooooooneeeey
*	Constants.Units // How many units 
*	
* @class Constants
*
*/
var Constants = {
	// Types
	InApp				: "IA0, IA1, IA4, IA9, IAA, IAC, IAW, IAY, IA3, IA6, IAB, IAD, IAX, IAZ",
	App  				: "1E, 1EP, 1EU,1F,1T, 4E, 4EP, 4EU, 4F, 4T, 7, 8, 7F, 7T, 8F, 8T, 2, 3, 5, 6, 2F, 2T, 3F, 3T, 5F, 5T, 6F, 6T, 1, 4",
	// Transactions
	Free 				: "1, 2, 3, 4",
	Paid 				:  "5, 6, 7, 8, 9, 54",
	Redownload 			: "1001, 1005, 1006",
	Update 				: "1002",
	Refund 				: "1003",
	// Platforms
	Desktop 			: "Windows, Macintosh, UNKNOWN",
	iPhone 				: "iPhone",
	iPad 				: "iPad",
	iPod 				: "iPod",
	// Measures
	Proceeds 			: "Royalty",
	Units 				: "units"
};

/*
* Expose `Constants`.
*/

exports.Constants = Constants;

/**
* Initialize a new `iTunesConnect` with the given `username`, `password` and `options`.
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*	
*	// Init new iTunes Connect
*	var itunes = new iTunesConnect('apple@id.com', 'password');
*
*	// Init new iTunes Connect
*	var itunes = new iTunesConnect('apple@id.com', 'password', {
*		errorCallback: function(error) {
*			console.log(error);
*		},
*		concurrentRequests: 1
*	});
*	
* @class iTunesConnect
* @constructor
* @param {String} username Apple ID login
* @param {String} password Apple ID password
* @param {Object} [options]
* @param {String} [options.baseURL] iTunes Connect Login URL
* @param {String} [options.apiURL] iTunes Connect API URL
* @param {Number} [options.concurrentRequests] Number of concurrent requests
* @param {Function} [options.errorCallback] Error callback function called when requests are failing
*/

function iTunesConnect(username, password, options) {
	// Default Options
	this.options = {
		baseURL				: "https://itunesconnect.apple.com",
		apiURL				: "https://reportingitc2.apple.com/api/",
		concurrentRequests	: 2,
		errorCallback		: function(e) {}
	};
	// Extend options
	_.extend(this.options, options);

	// Set cookies
	this._cookies = [];

	// Task Executor
	this._queue = async.queue(
		this.executeRequest.bind(this), 
		this.options.concurrentRequests
	);
	// Pasue queue and wait for login to complete
	this._queue.pause();
	// Login to iTunes Connect
	this.login(username, password);
}

/**
* Request iTunes Connect report with the given `query` and `completed` callback.
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*	
*	// Init new iTunes Connect
*	var itunes = new iTunesConnect('apple@id.com', 'password');
*
*	// Request timed report from yesterday to today
*	itunes.request(ReportQuery.timed().time(1, 'day'), function(error, result) {
*		console.log(result);
*	})
*	
* @method request
* @for iTunesConnect
* @param {Query} query
* @param {Function} completed
* @param {Error} completed.error Just an error if occure
* @param {Object} completed.result Report result 
* @param {Object} [completed.query] Query that was sent
* @chainable
*/

iTunesConnect.prototype.request = function(query, completed) {
	// Push request to queue
	this._queue.push({
		query: query, 
		completed: completed
	});

	return this;
}

/**
* Fetch iTunes Connect Reporting metadata with given `completed` callback.
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*	
*	// Init new iTunes Connect
*	var itunes = new iTunesConnect('apple@id.com', 'password');
*
*	// Fetch API Metadata
*	itunes.metadata(function(error, result) {
*		console.log(result);
*	})
*	
* @method metadata
* @for iTunesConnect
* @for iTunesConnect
* @param {Function} completed
* @param {Error} completed.error Just an error if occure
* @param {Object} completed.result Metadata result 
* @param {Object} [completed.query] Query that was sent
*/

iTunesConnect.prototype.metadata = function(completed) {
	var query = {
		body: function(){},
		endpoint: "all_metadata"
	}
	this._queue.push({query: query, completed: completed});
}

/**
* Execute iTunes Connect report request with given `task` and `callback`.
*
* @private
* @method executeRequest
* @for iTunesConnect
* @param {Object} task
* @param {Function} callback
*/

iTunesConnect.prototype.executeRequest = function(task, callback) {
	var query = task.query;
	var completed = task.completed;
	// Keep request body for callback
	var requestBody = query.body();
	// Run request
	request.post({
		url 	: this.options.apiURL + query.endpoint,
		body 	: requestBody,
		headers	: {
			'Content-Type': 'application/json',
			'Cookie': this._cookies
		}
	}, function(error, response, body) {
		if(response.statusCode == 401) {
			error = new Error('This request requires authentication. Please check your username and password.');
			body  = null;
		}
		else {
			try {
				body = JSON.parse(body);
			} catch (e) {
				error = new Error('There was an error while parsing JSON.');
				body  = null;
			}
		}
		// Call completed callback
		completed(error, body, requestBody);
		// Call callback to mark queue task as done
		callback();
	})
}

/**
* Login to iTunes Connect with given `username` and `password`.
*
* @private
* @method login
* @for iTunesConnect
* @param {String} username Apple ID login
* @param {String} password Apple ID password
*/

iTunesConnect.prototype.login = function(username, password) {
	var self = this;
	// Request ITC to get fresh post action
	request.get(this.options.baseURL, function(error, response, body) {
		// Handle Errors

		// Search for action attribute
		var html = cheerio.load(body);
		var action = html('form').attr('action');

		// Login to ITC
		request.post({
			url : self.options.baseURL + action, 
			form: {
				'theAccountName' 	: username,
				'theAccountPW'		: password,
				'theAuxValue'		: ""
			}
		}, function(error, response, body) {
			var cookies = response.headers['set-cookie'];
			// Handle Errors
			if(error || !cookies.length) {
				error = error || new Error('There was a problem with recieving cookies. Please check your username and password.');
				this.options.errorCallback( error );
			}
			else { 
				// Set Cookies and emit event
				self._cookies = cookies;
				self._queue.resume();
			}
		});
	});
}

/**
* Initialize a new `Query` with the given `type` and `config`.
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*		Constants 		= iTunesConnect.Constants;
*	
*	// Init new iTunes Connect
*	var itunes = new iTunesConnect('apple@id.com', 'password');
*
*	// Timed type query
*	var query = ReportQuery('timed');
*	
*	// Ranked type query with config object
*	var query = ReportQuery('ranked', { limit: 100 });	
*
*	// Advanced Example
*	var advancedQuery = ReportQuery('timed', {
*		start 	: '2014-04-08',
*		end 	: '2014-04-25',
*		limit 	: 100,
*		filters : {
*			content: [{AppID}, {AppID}, {AppID}],
*			location: [{LocationID}, {LocationID}],
*			transaction: Constants.Free,
*			type: [
*				Constants.InApp, 
*				Constants.App
*			],
*			category: {CategoryID}
*		},
*		group: 'content'
*	});	
*	
* @class ReportQuery
* @constructor
* @param {String} <type>
* @param {Object} [config]
* @param {String|Date} [config.start] Date or if String must be in format YYYY-MM-DD
* @param {Object} [config.end] Date or if String must be in format YYYY-MM-DD
* @param {String} [config.interval] One of the following:
* @param {String} config.interval.day
* @param {String} config.interval.week
* @param {String} config.interval.month
* @param {String} config.interval.quarter
* @param {String} config.interval.year
* @param {Object} [config.filters] Possible keys:
* @param {Number|Array} [config.filters.content]
* @param {String|Array} [config.filters.type]
* @param {String|Array} [config.filters.transaction] 
* @param {Number|Array} [config.filters.category]
* @param {String|Array} [config.filters.platform]
* @param {Number|Array} [config.filters.location]
* @param {String} [config.group] One of following: 
* @param {String} config.group.content
* @param {String} config.group.type
* @param {String} config.group.transaction
* @param {String} config.group.category
* @param {String} config.group.platform
* @param {String} config.group.location
* @param {Object} [config.measures]
* @param {Number} [config.limit]
* @return {Query}
*/

function ReportQuery(type, config) {
	var fn = Query.prototype[type];
	if(typeof fn !== 'function') {
		throw new Error('Unknown ReportQuery type: ' + type);
	}
	return new Query(config)[type]();
}

/**
* Initialize a new `Query` with the ranked type and given `config`.
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*	
*	// Init new iTunes Connect
*	var itunes = new iTunesConnect('apple@id.com', 'password');
*
*	// Ranked type query
*	var query = ReportQuery.ranked();
*
*	// Another query
*	var otherQuery = ReportQuery.ranked({
*		limit: 10
*	});	
*	
* @method ranked
* @for ReportQuery
* @param {Object} [config]
* @chainable
* @return {Query}
*/

ReportQuery.ranked = function(config) {
	return new Query(config).ranked();
}

/**
* Initialize a new `Query` with the timed type and given `config`.
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*	
*	// Init new iTunes Connect
*	var itunes = new iTunesConnect('apple@id.com', 'password');
*
*	// Timed type query
*	var query = ReportQuery.timed();
*
*	// Another query
*	var otherQuery = ReportQuery.timed({
*		limit: 10
*	});	
*	
* @method timed
* @for ReportQuery
* @param {Object} [config]
* @chainable
* @return {Query}
*/

ReportQuery.timed = function(config) {
	return new Query(config).timed();
}

/**
* Initialize a new `Query` with the given `query`.
*
* @class Query
* @constructor
* @private
* @param {Object} config
* @chainable
* @return {Query}
*/

function Query(config) {
	this.type   			= null;
	this.endpoint 			= null;

	this.config = {
		start 		: moment(),
		end 		: moment(),
		filters 	: {},
		measures	: ['units'],
		limit 		: 100
	};
	// Extend options with user stuff
	_.extend(this.config, config);

	// Private Options
	this._time    = null;
	this._body    = {};
}

/**
* Builds and returns body for iTunesConnect request as JSON string
*
* @method body
* @for Query
* @private
* @return {String} JSON String
*/

Query.prototype.body = function() {
	// Ensure date is moment object
	this.config.start = TransformValue.toMomentObject(this.config.start);
	this.config.end = TransformValue.toMomentObject(this.config.end);

	// If start and end date are same and time() was used in query calculate new start date
	if (this.config.end.diff(this.config.start, 'days') === 0 && _.isArray(this._time)) {
		this.config.start = this.config.start.subtract(this._time[0], this._time[1]);
	}

	// Building body
	this._body = {
		"start_date"	: this.config.start.format("YYYY-MM-DD[T00:00:00.000Z]"),
		"end_date"		: this.config.end.format("YYYY-MM-DD[T00:00:00.000Z]"),
		"interval"		: this.config.interval,
		"filters"		: TransformValue.toBodyFilters(this.config.filters),
		"group"			: TransformValue.toAppleKey(this.config.group),
		"measures"		: this.config.measures,
		"limit"			: this.config.limit
	};
	return JSON.stringify(this._body);
}

/**
* Initialize a new `Query` with the timed type.
*
* @private
* @method timed
* @for Query
* @chainable
*/

Query.prototype.timed = function() {
	this.type 		= 'timed';
	this.endpoint 	= 'data/timeseries';

	// Defaults for ranked type
	this.config.group = this.config.group || null;
	this.config.interval = this.config.interval || 'day';

	return this;
}

/**
* Initialize a new `Query` with the ranked type.
*
* @private
* @method ranked
* @for Query
* @chainable
*/

Query.prototype.ranked = function() {
	this.type 		= 'ranked';
	this.endpoint 	= 'data/ranked';

	// Defaults for ranked type
	this.config.group = this.config.group || 'content';
	this.config.interval = this.config.interval || 'day';

	return this;
}

/**
* Sets interval property for `Query`
*
* @method interval
* @for Query
* @param {String} value One of the following: 
* @param {String} value.day 
* @param {String} value.week
* @param {String} value.month 
* @param {String} value.quarter
* @param {String} value.year
* @chainable
*/

Query.prototype.interval = function(value) {
	this.config.interval = value;
	return this;
}

/**
* Sets start and end property for `Query`
*
* Examples:
*
*	// Start and end date set manualy
*	query.date('2014-04-08', new Date());
*
*	// Start and end date will be todays date
*	query.date(new Date());
*
*	// Start and end date will be set as 8th of April 2014
*	query.date('2014-04-08');
*
* @method date
* @for Query
* @param {String|Date} <start> If end is undefined it will be set same as start. If String, must be in format YYYY-MM-DD
* @param {String|Date} [end] If String, must be in format YYYY-MM-DD
* @chainable
*/

Query.prototype.date = function(start, end) {
	this.config.start = TransformValue.toMomentObject( start );
	this.config.end = TransformValue.toMomentObject( 
		((typeof end == 'undefined') ? start : end) 
	);

	return this;
}

/**
* Sets start property for `Query` in more easy/generic way
*
* Examples:
*
*	query.time(1, 'week');
*	query.time(20, 'days');
*
* @method time
* @for Query
* @param {Number} <value> 
* @param {String} <unit> day, week, month, etc...
* @chainable
*/

Query.prototype.time = function(value, unit) {
	this._time = [value, unit];
	return this;
}

/**
* Sets `group by` property for `Query`
*
* @method group
* @for Query
* @param {String} value One of following: 
* @param {String} value.content
* @param {String} value.type
* @param {String} value.transaction
* @param {String} value.category
* @param {String} value.platform
* @param {String} value.location
* @chainable
*/

Query.prototype.group = function(value) {
	this.config.group = value;
	return this;
}

/**
* Sets measures property for `Query`
*
* @method measures
* @for Query
* @param {String|Array} <value> 
* @chainable
*/

Query.prototype.measures = function(value) {
	this.config.measures = value;
	return this;
}

/**
* Sets limit property for `Query`
*
* @method limit
* @for Query
* @param {Number} <value> Not sure if Apple is using limit in ranked type query
* @chainable
*/

Query.prototype.limit = function(value) {
	this.config.limit = value;
	return this;
}

/**
* Sets content filter for `Query`
*
* @method content
* @for Query
* @param {Number|Array} <value> AppStore ID
* @chainable
*/

Query.prototype.content = function(value) {
	this.config.filters.content = value;
	return this;
}

/**
* Sets category filter for `Query`
*
* Examples:
*
*	// Import itc-report
*	var iTunesConnect 	= require("itc-report"),
*		ReportQuery   	= iTunesConnect.ReportQuery;
*	
*	// Query
*	var query = ReportQuery.timed({
*		limit: 10
*	}).category(6001);	
*
*	// Another Query
*	var otherQuery = ReportQuery.timed({
*		limit: 10
*	});
*	// OK
* 	otherQuery.category([6001, 6002, 6003]);
* 
*	// Wrong - This will not work as for version 0.0.1! 6003 will overwrite previously set category ids
* 	// You are more than welcome to sort this out in pull request. I saw no reason to do this.
* 	otherQuery.category([6001, 6002, 6003]).category(6003);	
*	
* @method category
* @for Query
* @param {Number|Array} <value> Visit https://github.com/stoprocent/itc-report/wiki/Cheet-Sheet#categories for available options
* @chainable
*/

Query.prototype.category = function(value) {
	this.config.filters.category = value;
	return this;
}

/**
* Sets location filter for `Query`
*
* @method location
* @for Query
* @param {Number|Array} <value> Visit https://github.com/stoprocent/itc-report/wiki/Cheet-Sheet#countries for available options
* @chainable
*/

Query.prototype.location = function(value) {
	this.config.filters.location = value;
	return this;
}

/**
* Sets platform filter for `Query`
*
* @method platform
* @for Query
* @param {String|Array} <value> (Look in Constants under Platforms)
* @chainable
*/

Query.prototype.platform = function(value) {
	this.config.filters.platform = value;
	return this;
}

/**
* Sets type filter for `Query`
*
* @method type
* @for Query
* @param {String|Array} <value> (Look in Constants under Types)
* @chainable
*/

Query.prototype.type = function(value) {
	this.config.filters.type = value;
	return this;
}

/**
* Sets transaction filter for `Query`
*
* @method transaction
* @for Query
* @param {String|Array} <value> (Look in Constants under Transactions)
* @chainable
*/

Query.prototype.transaction = function(value) {
	this.config.filters.transaction = value;
	return this;
}

/*
* Transform Value Object
*
* @private
*/

var TransformValue = {};

/*
* Translates simple filters object to apple api format
*
* @private
* @function toBodyFilters
* @for TransformValue
* @param {Object} filters
* @return {Object}
*/

TransformValue.toBodyFilters = function(filters) {
	var result = [];
	_.each(filters, function(value, dimension) {
		if(!_.isArray(value)) 
			value = [value];

		result.push({
			dimension_key	: TransformValue.toAppleKey(dimension),
			option_keys		: value
		});
	});

	return result;
}

/*
* Translates key to apple key
*
* @private
* @function toAppleKey
* @for TransformValue
* @param {String} key
* @return {String}
*/

TransformValue.toAppleKey = function(key) {
	if(key === null)
		return null;

	var keys = {
		content 	: "content",
		type 		: "content_type",
		transaction : "transaction_type",
		category 	: "Category",
		platform 	: "platform",
		location 	: "piano_location"
	};

	if(typeof keys[key] === 'undefined')
		throw new Error('Unknown Apple Key for key: ' + key);

	return keys[key];
}

/*
* Translates given date to moment object
*
* @private
* @function toMomentObject
* @for TransformValue
* @param {Mixed} date
* @return {Moment}
*/

TransformValue.toMomentObject = function(date) {
	// Quick check if moment
	if(moment.isMoment(date)) {
		return date;
	}
	else if(date instanceof Date) {
		return moment(date);
	}
	else if(_.isString(date) && !!(date.match(new RegExp(/([0-9]{4})-([0-9]{2})-([0-9]{2})/)))) {
		return moment(date, "YYYY-MM-DD");
	}
	else {
		throw new Error('Unknown date format. Please use Date() object or String() with format YYYY-MM-DD.');
	} 
}