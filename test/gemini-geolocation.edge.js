requirejs.config({
  baseUrl: '../',
  paths: {
    underscore: 'bower_components/underscore/underscore',
    jquery: 'bower_components/jquery/dist/jquery',
    handlebars: 'bower_components/handlebars/handlebars.runtime',
    'jquery.boiler': 'bower_components/jquery-boiler/jquery.boiler',
    'jquery.mockjax': 'bower_components/jquery-mockjax/src/jquery.mockjax',
    'gemini.support': 'bower_components/gemini-support/gemini.support',
    gemini: 'bower_components/gemini-loader/gemini',
    'js-cookie': 'bower_components/js-cookie/src/js.cookie'
  }
});

require([ 'gemini', 'gemini.geolocation', 'jquery.mockjax' ], function( G ) {
  function updateCurrentLocation( location ) {
    const $currentLocationEl = G( '#js-current-location' );

    if ( location === 'loading' ) {
      $currentLocationEl.text( `Loading...` );
      return;
    }

    if ( location === 'Error' ) {
      $currentLocationEl.text( `Geolocation Error` );
      return;
    }

    $currentLocationEl.text( `${location.city}, ${location.province_code}` );
  }

  const Geo = G.geolocation( 'instance' );

  Geo.bind( 'lookup', function() {
    updateCurrentLocation( 'loading' );
  });

  Geo.bind( 'error', function() {
    updateCurrentLocation( 'error' );
  });

  Geo.bind( 'change', function() {
    updateCurrentLocation( this.get());
  });

  Geo.bind( 'init', function() {
    updateCurrentLocation( this.get());
  });

  G( '#js-geolocate' ).click( function() {
    Geo.search({ reset: true });
  });

  G.mockjax({
    url: '/geography/locationlookup/',
    responseTime: 500,
    response: function() {
      this.responseText = {
        country_code: null,
        city: 'Binbrook',
        province_code: 'ON',
        latitude: '43.12018665423847',
        longitude: '-79.81543592010945'
      };
    }
  });
});
