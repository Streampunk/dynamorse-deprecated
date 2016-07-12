# AMWA Tech Together - London June 2016
## NMOS Demonstrated - Lightening version
### Demo crib sheet

Dr Richard Cartwright - Founder & CTO - Streampunk Media Ltd

## Introduction

* What we are trying to achieve as a new company.
  * Ground up implementation of JT-NM reference architecture, applying big data technologies and IoT concepts to media infrastructure on commodity IT.
  * Software-only infrastructure - Everything is browser-based, RESTful, cloud-ready, measured and monitored.
  * Education, design, implementation, support - based around a set of open source tools.
* Tour of Streampunk Media software. https://github.com/Streampunk and http://www.npmjs.com/~streampunk
  * dynamorse
  * ledger
  * codecadon
  * netadon
  * kelvinadon
  * macadam
* Interactive demonstration - no Powerpoint - questions welcome during and after
  * Prototype software, things will go wrong, restarts will be required please ask questions as we go ... or even follow along.
  * Install from scratch - on a £600 windows laptop
  * Set up registration & discovery service
  * Set up [Node-RED](http://nodered.org/) IoT tool for wiring virtual infrastructure
  * Design and deploy some simple infrastructure with a GUI
  * Meaure what we built

## Installation - prior to demo

### Platform

* Show installation of Node.js LTS from https://nodejs.org/en/
* Describe node.js and its package manager, culture etc.
* Discuss the need for a compiler at this time

### Registration and discovery - ledger

* Install nmos-ledger - how you install a node module.
  * Show instructions at https://www.npmjs.com/package/nmos-ledger
  * `npm install -g nmos-ledger`
  * `nmos-ledger`
  * Connect to:
    * [http://localhost:3002/x-nmos/query/v1.0/](http://localhost:3002/x-nmos/query/v1.0/) - leave open in a tab
    * [http://localhost:3001/x-nmos/registration/v1.0/](http://localhost:3001/x-nmos/registration/v1.0/)
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
* Browse GUI [http://localhost:8000/red/](http://localhost:8000/red/) and explore funnels, spouts, valves etc..
* Check the NMOS Reg&D NodeAPI at [http://localhost:3101/x-nmos/node/v1.0/](http://localhost:3101/x-nmos/node/v1.0/)

## Encoding a video stream

* Run `nmos-ledger`
* Run `dynamorse`
   * Browse GUI [http://localhost:8000/red/](http://localhost:8000/red/)
   * Quickly point out media-specific and non-media nodes

![video chain](../images/encode.png)
* Take a 2gig example file provided to NMOS incubator members, encode as H.264
* Measure the process using standard IT monitoring tools
* pcap reader setup:
  * Input file `/Users/sparkpunk/Documents/Streampunk/nmi-examples/rtp-video-rfc4175-1080i50-sync.pcap`
  * SDP file `file:../sdp_rfc4175_10bit_1080i50.sdp`
  * Set device in converter and encoder to `pipeline...`
  * Set output file to `out.h264` and headers `out.json`.
  * Play output in [VLC](http://www.videolan.org/vlc/) - File -> Open and select _other_ file extensions
  * Try again and set timeout to `40`ms - watch back pressure

* Show registration and discovery
   * Browse to the Node API [http://localhost:3101/x-nmos/node/v1.0](http://localhost:3101/x-nmos/node/v1.0)
   * Show the registrations via the Query API [http://localhost:3102/x-nmos/query/v1.0/](http://localhost:3102/x-nmos/query/v1.0/)

![monitoring](../images/grafana.png)
* Monitoring
  * What's going on on the system? - Measure and monitor
  * Show docker which is running two components
     * [Influxdb](https://influxdata.com/time-series-platform/influxdb/): [http://192.168.99.100:8083/](http://192.168.99.100:8083/)
     * [Grafana](http://grafana.org/): [http://192.168.99.100/login](http://192.168.99.100:8083/)
   * Set pcap-reader to loop - watch the graphs

## Summary

* Demonstrated software-only infrastructure - not software defined
* With registration and discovery - mDNS supported
* Wiring like the IoT
* Load managed like big data - reactive streams
* Monitored and measured

### Pre-demo

* Create demo-specific folder for dynamorse to ensure clean flows
* Check docker is running, load EBU NTS dashboard into grafana using [this file](ebu_nts_2016_graphs.json).
  * Command `docker run -it -p 8083:8083 -p 8086:8086 -p 80:3000 -p 8765:8765/udp scriptorian/grafin`
  * If environment problems `docker-machine env`
* cd to Documents folder in terminal.
* Clear down all browser tabs to just [this page](https://github.com/Streampunk/dynamorse/edit/master/doc/ebu_nts_demo_crib.md).


