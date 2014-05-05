/* Manage the users Geo Location - Based on Cookies, HTML5, and GeoIP =D
*** Requires jQuery Cookie Plugin
================================================== */
define(['jquery-loader', 'jquery.cookie'], function($){

	$.cookie.json = true;//JSON COOKIES!!

	var Geo = {

		// stores the event handlers
		_events: {
			// stores events that only run once
			one: {}
		},

		// the status
		_searching: false,

		// whether geolocation has been initiated
		_init: false,

		// lookup request
		_lookupRequest: false,

		// geolocation timeout
		_geoLocationTimeout: false,

		// search timeout
		_searchTimeout: false,

		// cache of the set location
		_currentLocation: {},

		// event handlers
		bind: function(event, callback){
			var that = this;
			$.each(event.split(' '), function(i, evt){
				if(that._events[evt]===undefined) that._events[evt] = [];
				that._events[evt].push(callback);
			});
			if(event == 'init' && this._init){
				this.trigger('init');
			}
		},

		one: function(event, callback){
			var that = this;
			$.each(event.split(' '), function(i, evt){
				if(that._events.one[evt]===undefined) that._events.one[evt] = [];
				that._events.one[evt].push(callback);
			});
		},

		trigger: function(event){
			var Geo = this;
			if(Geo._events[event]!==undefined)
				$.each(Geo._events[event], function(i, func){
					func.call(Geo);
				});

			if(Geo._events.one[event]!==undefined){
				$.each(Geo._events.one[event], function(i, func){
					func.call(Geo);
				});
				Geo._events.one[event] = [];
			}
		},

		//Sets a new location object
		set: function(location, cookie) {
			var Geo = this;

			if(cookie===undefined) cookie = true;

			Geo._searching = false;
			clearTimeout(Geo._searchTimeout);

			if(location) {
				//add the source and initiator
				location = $.extend({
					source: 'user',
					initiator: 'user'
				}, location);

				//parse it
				location = Geo._parseLocation(location);

				//cache the location
				this._currentLocation = location;

				//store the cookie?
				if(cookie && location.city !== '' && location.province_code !== '') {
					this._setCookie(location);
					if(Geo._init) Geo.trigger('cookie');
				}

				//change trigger
				if(!Geo._init){
					Geo._init = true;
					Geo.trigger('init');
				} else {
					Geo.trigger('change');
				}

			} else {
				$.error("Location was not sent to geolocation.");
			}

		},

		get: function(){
			return this._currentLocation;
		},

		search: function(options) {

			var Geo = this;

			// Start timeout
			Geo._searchTimeout = setTimeout(function(){Geo.trigger("error");},5000);

			// Cancel any currently running instances of geolocation
			if(Geo._searching) return;
			Geo._searching = true;

			// properties will be available through settings.propertyName
			var settings = $.extend({
				reset: false,
				initiator: "carpages",
				geoLocation: false
			}, options);

			// reset cookie
			if(settings.reset) $.removeCookie('geo_location', { path: '/' });

			//If the cookie was manually set by user
			if(Geo._getCookie().source == "user"){
				//Return that sucker right away
				Geo.set(Geo._getCookie());
			}else{
				//I will find you!!
				if(settings.geoLocation){
					Geo._runGeoLocation(settings.initiator);
				} else {
					Geo._runGeoIP(settings.initiator);
				}
			}

		},

		// Private functions
		_getCookie: function(){
			return $.cookie('geo_location') === null ? {} : $.cookie('geo_location');
		},

		_setCookie: function(location){
			$.removeCookie('geo_location', { path: '/' });

			if (location.initiator == "user"){
				$.cookie('geo_location', location, { expires: 365, path: '/' });//Expires in 365 days
			}else{
				$.cookie('geo_location', location, { path: '/' });//Expires at end of session
			}
		},

		_runGeoLocation: function(initiator){
			var Geo = this;

			//http://www.w3schools.com/html/html5_geolocation.asp
			if (navigator.geolocation) {

				if(Geo._getCookie().source == "geolocation"){//If geolocation has already been set
					Geo.set(Geo._getCookie());
				}else{
					//If HTML5 geoLocation is taking too long, use ip lookup
					Geo._geoLocationTimeout = setTimeout(function(){Geo._runGeoIP(initiator);},3000);

					navigator.geolocation.getCurrentPosition(function(position){
						//Geo location is successful

						clearTimeout(Geo._geoLocationTimeout);//Cancel IP lookup

						//Lookup the city and province
						Geo._lookup({
							data: position.coords,
							success: function(location) {
								//When geoIP returns
								location.source = "geolocation";
								location.initiator = initiator;

								Geo.set(location);
							}
						});
					}, function(){
						//When geoLocation fails
					});
				}
			} else {
				//fallback
				Geo._runGeoIP(initiator);
			}
		},

		_runGeoIP: function(initiator){
			//Look up the geo IP
			var Geo = this;

			if(Geo._getCookie().source=="ip"){//If ip was already found during this session

				Geo.set(Geo._getCookie());
			}else{
				//Otherwise, make a server call to find it

				Geo._lookup({
					data: {},
					success: function(location) {
						//When geoIP returns
						location.source = "ip";
						location.initiator = initiator;

						Geo.set(location);
					}
				});

			}
		},

		_lookup: function(options){
			this.trigger('lookup');

			this._lookupRequest = $.ajax($.extend({
				type: 'post',
				dataType: 'json',
				url: '/geography/locationlookup/'
			}, options));
		},

		_parseLocation: function(loc){
			//Province and city not set
			var R = loc; //to return

			R.city = !!loc.city ? loc.city : '';
			R.province_code = !!loc.province_code ? loc.province_code : '';
			R.latitude = !!loc.latitude ? loc.latitude : '';
			R.longitude = !!loc.longitude ? loc.longitude : '';
			R.latlng = !!loc.latitude && !!loc.longitude ? R.latitude + ',' + R.longitude : '';

			if(!!loc.province_code && !!loc.city){
				R.title = loc.city + ', ' + loc.province_code;
			}else if(!!loc.province_code){
				R.title = loc.province_name || R.province_code;
			}else{
				R.title = '';
			}

			return R;
		}
	};

	// give bindings a second to load before initial search
	setTimeout(function(){
		Geo.search.call(Geo);
	}, 500);



	// add the Geo to the jQuery object
	$.geolocation = function() {
		var args = Array.prototype.slice.call(arguments),
			method = args[0],
			options = args.splice(1, 999);

		if (options === undefined) options = {};

		if(Geo[method]!==undefined && method.charAt[0] != '_'){
			if (typeof Geo[method] === 'function'){
				return Geo[method].apply(Geo, options) || $;
			} else {
				return Geo[method];
			}
		}

		return $;
	};

	// Return the jquery object
	// This way you don't need to require both jquery and the Geo
	return $;

});
