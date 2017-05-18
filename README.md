# myrtlelime-airports

This is a collection of airports used by the Myrtlelime family of travel sites, including
[BookWithMatrix](https://bookwithmatrix.com) and [All the Flight Deals](https://alltheflightdeals.com).

The data is sourced from multiple sites for completeness, and combined into one JSON file
with the important information. **It should only be used server-side, as it's huge.**

## Usage
```
var airports = require('myrtlelime-airports');

console.log(airports.airports);

// Prints
// [
//   {
//     "name": "Atmautluak Airport",
//     "city": "Atmautluak",
//     "country": "us",
//     "iata": "369",
//     "latitude": "60.866667",
//     "longitude": "-162.273056",
//     "timezone": "America/Anchorage",
//     "hasScheduledService": false,
//     "countryName": "United States",
//     "state": null
//   },
//   ...

console.log(airports.airportsKeyed);
// Prints
// {
//   "369": {
//     "name": "Atmautluak Airport",
//     "city": "Atmautluak",
//     "country": "us",
//     "iata": "369",
//     "latitude": "60.866667",
//     "longitude": "-162.273056",
//     "timezone": "America/Anchorage",
//     "hasScheduledService": false,
//     "countryName": "United States",
//     "state": null
//   },
//   ...
```
