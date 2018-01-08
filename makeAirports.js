'use strict';

var parse = require('csv-parse/lib/sync');
var fs = require('fs');
var _ = require('lodash');
var rlSync = require('readline-sync');

var nameToCode = require('./data/countries');
var codeToName = {};

// Use the first country for codeToName
_.forOwn(nameToCode, function(code, name) {
  if (!codeToName[code]) {
    codeToName[code] = name;
  }
});

var exportAsObject = process.argv[2] === '--object';

//
// Data import section
//

// airports.json import
var airportsJSON = require('./data/airports.json');

// airports.dat (OpenFlights) import
function readOpenFlights() {
  var data = fs.readFileSync(__dirname + '/data/airports.dat');
  var parsed = parse(data, {
    columns: ['id', 'name', 'city', 'country', 'iata', 'icao', 'latitude', 'longitude', 'altitude', 'utcOffset', 'dst', 'timezone']
  });
  parsed.forEach(function(entry) {
    _.forOwn(entry, function(value, key) {
      if (value === '\\N') {
        delete entry[key];
      }
    });
  });

  return parsed;
}

var openFlights = readOpenFlights();

var ourAirportsRaw = fs.readFileSync(__dirname + '/data/airports.csv');
var ourAirports = parse(ourAirportsRaw, { columns: true });

var iataTzmapRaw = _.filter(fs.readFileSync(__dirname + '/data/iata.tzmap').toString('utf8').split('\n'));
var iataTzmap = iataTzmapRaw.map(function(row) {
  var parts = row.split('\t');
  return {
    iata: parts[0],
    timezone: parts[1].trim(),
  };
});

/**
 * Get the country name from the country code (prompting if not recognized)
 * @param {string} countryName
 */
function getCountryCode(countryName) {
  if (!nameToCode[countryName]) {
    var code = rlSync.question('Enter the country code for ' + countryName);
    nameToCode[countryName] = code;
  }
  return nameToCode[countryName];
}

//
// Data merge section
//
var fields = {
  ourAirports: {
    name: 'name',
    city: 'municipality',
    state: function(entry) {
      if (entry.iso_country === 'US' || entry.iso_country === 'CA') {
        return entry.iso_region.split('-')[1];
      }
      return null;
    },
    country: 'iso_country',
    iata: 'iata_code',
    latitude: 'latitude_deg',
    longitude: 'longitude_deg',
    hasScheduledService: function(entry) {
      return entry.scheduled_service === 'yes';
    },
    icao: 'ident',
  },
  openFlights: {
    name: 'name',
    city: 'city',
    countryName: 'country',
    iata: 'iata',
    latitude: 'latitude',
    longitude: 'longitude',
    timezone: 'timezone',
    icao: 'icao',
  },
  airportsJSON: {
    name: 'name',
    city: 'city',
    countryName: 'country',
    iata: 'code',
    latitude: 'lat',
    longitude: 'lon',
    timezone: 'tz',
    hasScheduledService: function(entry) {
      return entry.direct_flights !== '0';
    },
    icao: 'icao',
  },
  iataTzmap: {
    iata: 'iata',
    timezone: 'timezone',
  },
};

var files = ['ourAirports', 'openFlights', 'airportsJSON', 'iataTzmap'];
var rawData = {
  ourAirports: ourAirports,
  openFlights: openFlights,
  airportsJSON: airportsJSON,
  iataTzmap: iataTzmap,
};

var airportsByIATA = {};
var airportsByICAO = {};

// Add data to airports objects with earlier files taking
// precedence over later files
files.forEach(function(file) {
  var fileData = rawData[file];
  var fileFields = fields[file];
  fileData.forEach(function(entry) {
    var fileAirport = {};
    _.forOwn(fileFields, function(field, key) {
      var value;
      if (typeof field === 'function') {
        value = field(entry);
      } else if (typeof field === 'string') {
        value = entry[field];
      }

      if (value != null && value !== '') {
        fileAirport[key] = value;
      }
    });

    var icao = fileAirport.icao;
    var iata = fileAirport.iata;
    var icaoAirport = icao && airportsByICAO[icao];
    var iataAirport = iata && airportsByIATA[iata];

    if (icaoAirport && iataAirport) {
      if (icaoAirport !== iataAirport) {
        // Merge the two, giving precedence to icaoAirport
        iataAirport = Object.assign({}, iataAirport, icaoAirport);
        icaoAirport = iataAirport;
      }
    }

    // At this point, icaoAirport === iataAirport if they're both present
    var airport = icaoAirport || iataAirport || {};

    // Merge fields
    airport = Object.assign({}, fileAirport, airport);

    // Small universal updates
    airport.country = airport.country && airport.country.toLowerCase();

    // Infer countries from country names and vice versa
    if (airport.countryName && !airport.country) {
      airport.country = getCountryCode(airport.countryName);
    }

    airport.countryName = codeToName[airport.country];
    airport.country = airport.country ? airport.country.toLowerCase() : null;

    if (icao) {
      airportsByICAO[icao] = airport;
    }
    if (iata) {
      airportsByIATA[iata] = airport;
    }
  });
});

var airports = _.uniq(_.values(airportsByIATA));
var requiredFields = [
  'name',
  'city',
  // 'state',
  'country',
  'iata',
  'latitude',
  'longitude',
  'timezone',
  'hasScheduledService',
  'icao',
];

airports = airports.filter(function(airport) {
  return requiredFields.every(function(field) {
    return airport[field] != null;
  });
}).map(function(airport) {
  // Discard unneeded precision
  airport.latitude = Math.round(parseFloat(airport.latitude) * 100000) / 100000;
  airport.longitude = Math.round(parseFloat(airport.longitude) * 100000) / 100000;
  return airport;
});

var airportsKeyed = _.fromPairs(airports.map(function(airport) {
  return [airport.iata, airport];
}));

if (exportAsObject) {
  console.log([
    '/* eslint-disable */',
    'module.exports = ' + JSON.stringify(airportsKeyed, null, 2) + ';'
  ].join('\n'));
} else {
  console.log([
    '/* eslint-disable */',
    'module.exports = ' + JSON.stringify(airports, null, 2) + ';'
  ].join('\n'));
}
