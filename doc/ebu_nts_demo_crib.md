# EBU NTS 2016
## NMOS Described and Demonstrated
### Demo crib sheet

## Introduction


* What we are trying to achieve as a new company.
 * Ground up implementation of JT-NM, applying big data technologies and IoT concepts to media infrastructure on commodity IT.
 * Education, design, implementation, support - based around a set of open source tools.
* Tour of Streampunk Media software. http://www.streampunk.media/ and http://www.npmjs.com/~streampunk
 * dynamorse
 * ledger
 * codecadon
 * netadon
 * kelvinadon
* Take an interactive tour
 * Prototype software, things will go wrong, please ask questions as we go ... or even follow along.
* Link back to what Peter has already talked about.

## Installation

### Platform
* Show installation of Node.js LTS from https://nodejs.org/en/
* Describe node.js and its package manager, culture etc.
* Discuss the need for a compiler at this time

### Regisrtration and discovery - ledger

* Install nmos-ledger - how you install a node module.
 * Show instructions at https://www.npmjs.com/package/nmos-ledger
 * `npm install -g nmos-ledger`
 * `nmos-ledger`
 * Connect to:
  * http://localhost:3002/x-nmos/query/v1.0/ - leave open in a tab
  * http://localhost:3001/x-nmos/registration/v1.0/
 * Show MDNS adveristisement:
  * `dns-sd -B _nmos-query._tcp`
  * `dns-sd -L ledger_query  _nmos-query._tcp`
  * `ping ledger_query.local`
  * `ping ledger_registration.local`

### Designing infrastructure - dynamorse



