/**
 * @fileoverview

Manage the users Geo Location - Based on Cookies, HTML5, and GeoIP

### Notes
- It's best to work with the user's location by binding callback functions

 *
 * @namespace gemini.geolocation
 * @copyright Carpages.ca 2014
 * @author Matt Rose <matt@mattrose.ca>
 *
 * @requires gemini
 * @requires jquery.cookie
 *
 * @example
  // Callback for initial load
  G.geolocation('bind', 'init', function() {
    // 'this' has access to all of the plugins methods
    var geo = this;
  });

  // Callback for when the location changes
  G.geolocation('bind', 'change', function() {
    consele.log(this.get());
  });
 */
(function(factory) {
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define([
      "gemini",
      "jquery.cookie"
    ], factory);
  } else if (typeof exports === "object") {
    // Node/CommonJS
    module.exports = factory(
      require("gemini-loader"),
      require("jquery.cookie")
    );
  } else {
    // Browser globals
    factory(G);
  }
}(function($) {

  $.cookie.json = true;//JSON COOKIES!!

  var Geo = {

    // stores the event handlers
    _events: {
      // stores events that only run once
      one: {}
    },

    // the status
    _searching: false,

    // whether the browser supports HTML5 geolocation
    _support: ("geolocation" in navigator),

    // whether geolocation has been initiated
    _init: false,

    // lookup request
    _lookupRequest: false,

    // geolocation timeout
    _geolocationTimeout: false,

    // geolocation timeout in milliseconds
    _geolocationMaxTimeout: 4000,

    // search timeout
    _searchTimeout: false,

    // cache of the set location
    _currentLocation: {},

    // default URL to search geolocation object
    _defaultUrl: "/geography/locationlookup/",

    /**
     * Bind events to different location changes
       *Note:* You can bind several events at once using spaces
       - init - Runs on first location initiation
       - change - Runs when the location is changed
     *
     * @method
     * @name gemini.geolocation#bind
     * @param {string} event The name of the event(s)
     * @param {function} callback The callback function
    **/
    bind: function(event, callback) {
      var Geo = this;

      $.each(event.split(" "), function(i, evt) {
        if(Geo._events[evt]===undefined) Geo._events[evt] = [];
        // Call init events immediately if init has already been run
        if(evt == "init" && Geo._init) {
          callback.call(Geo);
        }
        Geo._events[evt].push(callback);
      });

    },

    /**
     * Bind an event to run only once
     *
     * @method
     * @name gemini.geolocation#one
     * @param {string} event The name of the event(s)
     * @param {function} callback The callback function
    **/
    one: function(event, callback) {
      var that = this;
      $.each(event.split(" "), function(i, evt){
        if(that._events.one[evt]===undefined) that._events.one[evt] = [];
        that._events.one[evt].push(callback);
      });
    },

    /**
     * Trigger an event to run
     *
     * @method
     * @name gemini.geolocation#trigger
     * @param {string} event The name of the event(s)
    **/
    trigger: function(event) {
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

    /**
     * Set the user's location using the location object:
     ```
      {
        "city": "",
        "province_code": "",
        "latitude": "",
        "longitude": ""
      }
     ```
     *
     * @method
     * @name gemini.geolocation#set
     * @param {string} location The location object
     * @param {boolean} cookie Whether to store a cookie
    **/
    set: function(location, cookie) {
      var Geo = this;

      if(cookie === undefined) cookie = true;

      Geo._searching = false;
      clearTimeout(Geo._searchTimeout);

      if(!!location.city) {
        //add the source and initiator
        location = $.extend({
          source: "user",
          initiator: "user"
        }, location);

        //parse it
        location = Geo._parseLocation(location);

        //cache the location
        this._currentLocation = location;

        //store the cookie?
        if(cookie && location.city !== " && location.province_code !== ") {
          this._setCookie(location);
          if(Geo._init) Geo.trigger("cookie");
        }

        //change trigger
        if(!Geo._init){
          Geo._init = true;
          Geo.trigger("init");
        } else {
          Geo.trigger("change");
        }

      } else {
        Geo.trigger("error");
        $.error([
          "Location was not properly sent to geolocation. Check to make sure",
          "the lookup URL's are sending back the right data."
        ].join(" "));
      }

    },

    /**
     * Get the current location
     *
     * @method
     * @name gemini.geolocation#get
     * @return {object} Current location
    **/
    get: function(){
      return this._currentLocation;
    },

    /**
     * Search for the users location
     *
     * @method
     * @name gemini.geolocation#search
     * @param {object} options The options for the search
     * @param {boolean} options.reset Weather to ignore any existing cookies
     * @param {string} options.initiator The item that initiated the search (default is 'carpages')
    **/
    search: function(options) {

      var Geo = this;

      // Start timeout
      Geo._searchTimeout = setTimeout(function() {
        Geo.trigger("error");
        $.error([
          "The geolocation lookup and and ip lookup timed out."
        ].join(" "));
      }, Geo._geolocationMaxTimeout + 3000);

      // No need to double up on searches
      if(Geo._searching)
        return;
      Geo._searching = true;

      // properties will be available through settings.propertyName
      var settings = $.extend({
        reset: false,
        initiator: "carpages"
      }, options);

      // reset cookie
      if(settings.reset)
        Geo._removeCookie();

      // Send back results quickly if cookie is found
      var cookie = Geo._getCookie();

      switch (cookie.source) {
        case "user":
        case "geolocation":
          Geo.set(cookie);
          break;
        case "ip":
          if(!Geo._support) {
            Geo.set(cookie);
            break;
          }
        default:
          //I will find you!!
          Geo._iWillFindYou(settings.initiator);
      }

    },

    /**
     * Set the lookup defaultUrl to a different value than
     * "/geography/locationlookup/"
     *
     * @method
     * @name gemini.geolocation#url
     * @param {string} url The URL to query for location lookup
    **/
    url: function(url) {

      this._defaultUrl = url;

    },

    /**
     * Get the current cookie object
     *
     * @private
     * @method
     * @name gemini.geolocation#_getCookie
     * @return {object} The stored cookie object
    **/
    _getCookie: function(){
      return !$.cookie("geo_location") ?
        {} :
        $.cookie("geo_location");
    },

    /**
     * Remove current cookie object
     *
     * @private
     * @method
     * @name gemini.geolocation#_removeCookie
    **/
    _removeCookie: function() {
      $.removeCookie("geo_location", { path: "/" });
    },

    /**
     * Set the cookie of the location
     * *Note:* Setting location.initiator to "user" will store the cookie for a year
     *
     * @private
     * @method
     * @name gemini.geolocation#_setCookie
     * @param {object} location The location object to store
    **/
    _setCookie: function(location){
      Geo._removeCookie();

      if (location.initiator == "user"){
        //Expires in 365 days
        $.cookie("geo_location", location, { expires: 365, path: "/" });
      } else {
        //Expires at end of session
        $.cookie("geo_location", location, { path: "/" });
      }
    },

    /**
     * Run a search using HTML5 geolocation
     *
     * @private
     * @method
     * @name gemini.geolocation#_iWillFindYou
     * @param {string} initiator The initiator of this search
    **/
    _iWillFindYou: function(initiator){
      var Geo = this;

      if (Geo._support) {

        //If HTML5 geolocation is taking too long, use ip lookup
        Geo._geolocationTimeout = setTimeout(function() {
          Geo._runGeoIP(initiator);
        }, Geo._geolocationMaxTimeout);

        navigator.geolocation.getCurrentPosition(function(position) {
          //Geo location is successful

          //Cancel IP lookup
          clearTimeout(Geo._geolocationTimeout);

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
          //When geolocation fails
        },
        {
          timeout: Geo._geolocationMaxTimeout
        }
        );
      } else {
        //fallback
        Geo._runGeoIP(initiator);
      }
    },

    /**
     * Run a search using IP search
     *
     * @private
     * @method
     * @name gemini.geolocation#_runGeoIP
     * @param {string} initiator The initiator of this search
    **/
    _runGeoIP: function(initiator) {
      //Look up the geo IP
      var Geo = this;

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

    },

    /**
     * Lookup location info using coordinates
     *
     * @private
     * @method
     * @name gemini.geolocation#_lookup
     * @param {object} options Options to send in the ajax request
    **/
    _lookup: function(options) {
      var plugin = this;

      plugin.trigger("lookup");

      plugin._lookupRequest = $.ajax($.extend({
        type: "post",
        dataType: "json",
        url: plugin._defaultUrl
      }, options));
    },

    /**
     * Parse the location object
     *
     * @private
     * @method
     * @name gemini.geolocation#_parseLocation
     * @param {object} location Location object to parse
     * @return {object} The new location object
    **/
    _parseLocation: function(location) {
      //Province and city not set
      var R = location; //to return

      R.city = !!location.city ? location.city : "";
      R.province_code = !!location.province_code ? location.province_code : "";
      R.latitude = !!location.latitude ? location.latitude : "";
      R.longitude = !!location.longitude ? location.longitude : "";
      R.latlng = !!location.latitude && !!location.longitude ?
                 R.latitude + "," + R.longitude :
                 "";

      if(!!location.province_code && !!location.city) {
        R.title = location.city + ", " + location.province_code;
      }else if(!!location.province_code) {
        R.title = location.province_name || R.province_code;
      }else{
        R.title = "";
      }

      return R;
    }
  };

  // Do initial search
  Geo.search.call(Geo);

  // add the Geo to the jQuery object
  $.geolocation = function() {
    var args = Array.prototype.slice.call(arguments),
      method = args[0],
      options = args.splice(1, 999);

    if (options === undefined) options = {};

    if(Geo[method]!==undefined && method.charAt[0] != "_") {
      if (typeof Geo[method] === "function") {
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

}));
