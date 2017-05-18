'use strict';

var parse = require('csv-parse/lib/sync');
var fs = require('fs');
var _ = require('lodash');
var rlSync = require('readline-sync');

var nameToCode = require('./data/countries');
var airportsJSON = require('./data/airports.json');

var exportAsObject = process.argv[2] === '--object';

// Use airports.dat to start
function readAirportsDat() {
  var data = fs.readFileSync(__dirname + '/data/airports.dat');
  return parse(data, {
    columns: ['id', 'name', 'city', 'country', 'iata', 'icao', 'latitude', 'longitude', 'altitude', 'utcOffset', 'dst', 'timezone']
  });
}

function isValidAirport(entry) {
  return entry.iata && entry.timezone && entry.timezone !== '\\N';
}

var airports = readAirportsDat().filter(isValidAirport);

// Get country codes countries.js
var countries = _.uniq(_.map(airports, 'country'));
countries.forEach(function(country) {
  if (!nameToCode[country]) {
    var code = rlSync.question('Enter the country code for ' + country);
    nameToCode[country] = code;
  }
});

// Get hasScheduledService from the airports.csv file from OurAirports
var ourAirportsRaw = fs.readFileSync(__dirname + '/data/airports.csv');
var ourAirportsRows = parse(ourAirportsRaw, { columns: true });
var hasScheduledService = {};
var states = {};
ourAirportsRows.forEach(function(airport) {
  var iata = airport.iata_code;
  if (!iata) return;

  hasScheduledService[iata] = hasScheduledService[iata] ||
    airport.scheduled_service === 'yes';

  states[iata] = airport.iso_region;
});

var countryNames = {};

airports = airports.map(function(airport) {
  airport.hasScheduledService = !!hasScheduledService[airport.iata];
  airport.countryName = airport.country;
  airport.country = nameToCode[airport.country];
  countryNames[airport.country] = countryNames[airport.country] || nameToCode[airport.country];
  airport.state = states[airport.iata] ? states[airport.iata].substr(3).toLowerCase() : null;

  return _.pick(airport, ['name', 'city', 'country', 'iata',
    'latitude', 'longitude', 'timezone', 'hasScheduledService',
    'countryName', 'state']);
});

// Key airports to be combined with airports.json
var airportsKeyed = {};
airports.forEach(function(airport) {
  if (!airport.country) return;

  if (!airportsKeyed[airport.iata] ||
      airport.hasScheduledService) {
    airportsKeyed[airport.iata] = airport;
  }
});

airportsJSON.forEach(function(airport) {
  // keys: code, lat, lon, name, city, state (full), country (full),
  //       tz, type, direct_flights
  var iata = airport.code;
  if (!airportsKeyed[iata]) {
    var requiredKeys = ['code', 'lat', 'lon', 'name', 'city', 'country', 'tz'];
    // Skip airports with missing data
    if (!_.every(_.values(_.pick(airport, requiredKeys)))) {
      return;
    }

    var country = nameToCode[airport.country];
    var countryName = countryNames[country] || airport.country;

    airportsKeyed[iata] = {
      name: airport.name,
      city: airport.city,
      state: null,
      country: country,
      countryName: countryName,
      iata: iata,
      latitude: airport.lat,
      longitude: airport.lon,
      timezone: airport.tz,
      hasScheduledService: airport.direct_flights !== '0'
    };
  }
});

airports = _.values(airportsKeyed);

if (exportAsObject) {
  console.log([
    '/* eslint-disable */',
    'module.exports = ' + JSON.stringify(airportsKeyed, null, 2)
  ].join('\n'));
} else {
  console.log([
    '/* eslint-disable */',
    'module.exports = ' + JSON.stringify(airports, null, 2)
  ].join('\n'));
}
