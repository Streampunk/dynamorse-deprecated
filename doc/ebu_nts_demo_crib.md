# EBU NTS 2016
## NMOS Described and Demonstrated
### Demo crib sheet

## Introduction


* What we are trying to achieve as a new company.
 * Ground up implementation of JT-NM, applying big data technologies and IoT concepts to media infrastructure on commodity IT.
 * Everything is browser-based, RESTful, cloud-ready, measured and monitored.
 * Education, design, implementation, support - based around a set of open source tools.
* Tour of Streampunk Media software. http://www.streampunk.media/ and http://www.npmjs.com/~streampunk
 * dynamorse
 * ledger
 * codecadon
 * netadon
 * kelvinadon
* Take an interactive tour
 * Prototype software, things will go wrong, restarts will be required please ask questions as we go ... or even follow along.
 * Install from scratch
 * Set up registration & discovery service
 * Set up Node-RED IoT tool for wiring virtual infrastructure
 * Design and deploy some simple infrastructure with a GUI
 * Meaure what we built
 * Build it again via an API
* Link back to what Peter has already talked about.
* Everything here can be downloaded and used for free

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

* Install dynamorse
  * Show instructions at https://www.npmjs.com/package/dynamorse
  * Create and enter a new folder for this demonstration
  * `npm install -g dynamorse`
  * `dynamorse`
* Run GUI http://localhost:8000/red/ and explore funnels, spouts, valves etc..
* Check the NMOS Reg&D NodeAPI at http://localhost:3101/x-nmos/node/v1.0/
  * Browser to node API description of self http://localhost:3101/x-nmos/node/v1.0/self
  * Show that the node has registered itself via query API http://localhost:3002/x-nmos/query/v1.0/nodes
  * Show the devices http://localhost:3101/x-nmos/node/v1.0/devices
  * Show the devices as registered http://localhost:3002/x-nmos/query/v1.0/devices
  * Explore the API by dereferncing a node, e.g. http://localhost:3002/x-nmos/query/v1.0/nodes/<uuid-of-a-node>
* Recap - run NMOS registration service, run NMOS node with 2 devices, node discovers and registers, made a query

### My first flow - grains 101

* Everything that flows in NMOS is a _grain_. Grains have:
  * Payload - the elements of essnece
  * Timestamps - origin and sync + optional SMPTE timecode
  * Flow and Source identifiers
  * Duration
* Let's see one!
  * Download a grain from https://github.com/AMWA-TV/nmos-in-stream-id-timing/blob/master/examples/pcap/rtp-audio-l24-2chan.pcap?raw=true
  * Download an SDP file that describes the nature of the grain https://raw.githubusercontent.com/AMWA-TV/nmos-in-stream-id-timing/master/examples/sdp/sdp_L24_2chan.sdp
  * Look at the grain in [Wireshark](https://www.wireshark.org/download.html) with [NMOS plugin](https://github.com/AMWA-TV/nmos-in-stream-id-timing/tree/master/software/wireshark_plugins)
  * 



