# Dynamorse

IT swiss army knife for professional media infrastructure and production. This is a *prototype* Node.JS application that demonstrates:

* Putting the Joint Taskforce for Networked Media's Reference Architecture to work - streaming professional quality media with support for identity, timimg and NMOS registration and discovery;
* Applying Internet of Things concepts (IBM's Node-RED) to running media infrastructure on commodity IT systems, changing traditinal infrastructure into a drag-and-drop interfaces and JSON REST APIs;
* Using reactive streams concepts from big data to manage, monitor and balance resources, including CPU load.

## Funnels and spouts

Dynamorse treats all of the following kinds of media as streaming equals, turning them into _flows_ of _grains_:

* RTP streams - TR-03, ASPEN MPEG-TS;
* HTTP streams - Streampunk-defined and MPEG-DASH;
* Raw files - H.264 bytestream, uncompressed - DPX-style, WAV;
* Container file formats - MXF, MOV;
* SDI streams - BlackMagic DeckLINK API, SMPTE 2022-6.

Inputs are called _funnels_, outputs are called _spouts_.

## Valves

Create pipelines between the funnels and spouts and add _valves_ that transform the media as it flows. Transformations include:

* Encoding - convert uncompressed flows into compressed flows;
* Decoding - convert compressed flows into uncompressed flows;
* Converting - 10-bit to 8-bit, RFC4175 pixel groups to the common V210 bytestream format, picture rescaling.
* Switch - switch between different inputs and grain boundaries.
* Graphics - pass each grain through a graphics programming library to, for example, add text or a bug.

## Fittings

The final piece of the dynamorse jigsaw puzzle are the pipe _fittings_ - a set of utilities that allow flows to be combined. This is the beginning of a journey towards the development of a stream-based creation and delivery tool, enabling Immersive Social TV experiences that can personalized to who is watching. Features include:

* Constrain the number of grains that flow down a pipe;
* Sequence a set of _flows_ one after the other;
* Set an alternative source in the event the expected source is not available;
* Rate limit or retime a flow;
* Apply a function that transforms either the metadata or payload flowing down a pipe.

## NMOS-inside

As well as being a means to move and process media data through a CPU/GPU and its connected interfaces, each running instance of dynamorse is a Neworked Media Open Specifications Registration and Discovery _node_. The implementation uses Streampunk Media's _ledger_ implementation of the NMOS specifications, also available as an open-source project. Each node has two NMOS _devices_:

1. _generic_ - funnels and spouts that expose flows via NMOS _senders_ and _receivers_. These resources are registered with any NMOS discovery interface found on the network.
2. _pipeline_ - All _flows_ and _sources_ within dynamorse are represented according to the NMOS data model and the _tags_ property of a flow is used to hold technical metadata.

## Redioactive

Dynamorse is _redioactive_, which means that it adds a library of features to support reactive streams to the default behavior of Node-RED. By default, Node-RED uses an event-based model where producers fire update events along the pipelines whether or not the consumer is ready to receive them, or consumers are sat waiting for events because the producer has been throttled back.

With reactive streams support, the consumer signals to the producer when it is ready to receive more inputs, a process known as _back pressure_. The producer then pushes down the next element, which it may have optimistically buffered. Producers and consumers can be chained together so that back pressure goes along the length of a pipe.

As an example, consider a file reader funnel on an SSD feeding a real-time display funnel. The file reader can ready the picture data from the file at around twice real time, whereas the display can only cope with real-time data. With no back-pressure, the display consumer is overloaded and starts to drop frames. With back pressure, the display stops asking for frames when its buffer is full and the file-reader stops reading from the disk when its buffer is full. When the display's buffer starts to clear, it starts asking for frames again. As the file-reader satisfies the requests for frames and its buffer starts to empty, it starts to read another batch from the disk.

With real time streams and a slow consumer, at some point the producer's buffer will overflow and frames will be dropped. This is a symptom of a design problem with a pipeline or resource overload (see monitoring in the next section) that should not occur in normal operation. Errors are produced and can be monitored whenever a buffer is overloaded. Each dynamorse node - other than the spouts - has a buffer size parameter.

The design of redioactive was inspired by highland.js but direct integration of highland with Node-RED did not seem to be possible at the time of implementation.

## Watchful eye

Each dynamorse instance can send statistics to _influxdb_, a time series database that is optimized for storing and searching metrics information. The running instance sends metrics about the overall performance of the application, along with each Node-RED node sending details about how many grains it processed per second and how long it took to process each grain. This data can be mined and turned into reports or graphed in real time with tools such as Apache's Grafana.

Dynamorse uses standard IT tools so that it fits alongside other metrics systems and applications in an enterprise IT environment. Combined with system monitoring tools that also work with the same toolsets, such as _collectd_, it is possible to monitor and respond to issues such as real-time streams about to dropping below real-time performance. Also, developers and testers can analyze performance by watching for memory leaks, buffer overflows, the impact of garbage collection etc..

# Getting started

## Installation

Install Node.js for your plarform. This software has been developed against the long term stable (LTS) release. To install dynamorse as a global application on your system:

    npm install -g dynamorse

Mac and linux users may have to prepend `sudo` to the above.

Dynamorse depends on modules that use native C++ bindings that compile with node-gyp. To use these modules, you many need to install a C++ compiler and python on your system if these are not present. On Windows, compilation has been tested using the community edition of Microsoft Visual Studio.

At this time, dynamorse is not intended for use as dependency in other projects. However, you may wish to install dynamorse locally in a `node_modules` sub-folder. In which case:

    npm install dynamorse

## Running

To run dynamorse when it is installed as a global application (`-g` flag):

    dynamorse

To run a local install (Linux/Mac/cygwin flavor):

    $(npm bin)/dynamorse

Connect to the user interface via a web browser. By default, the UI runs on port `8000`, so use [http://localhost:8000/]. The NMOS Node API runs on port `3001` be default, so connect in another tab with [http://localhost:3001/x-nmos/node/v1.0/]. Alternatively, connect over HTTP from a another browser.

The choice of available nodes is provided down the left-hand-side. Each node is self-describing - click on it and it describes what it is and how to configure it in the info panel on the right-hand-side. Drag nodes out into the central flow designer panel and link them together by joining output ports to input ports.

Once you are happy with a design, hit the deploy button. This will send the flow to the dynamorse server and the server will attempt to run it. Check the debug tab on the right-hand-side for live debug messages and errors.

### Thread pool size

The default thread pool size for libuv, an underlying component of node, is only sufficient for 2 or 3 dynamorse nodes. To increase the size of the pool, set the `UV_THREADPOOL_SIZE` environment variable to a number higher than the default of `4`. On Mac/Linux:

    export UV_THREADPOOL_SIZE=32

On Windows:

    set UV_THREADPOOL_SIZE=32

## Examples to try

To follow.

## Configuration nodes

To follow.

# Support, status and further development

Streampunk Media have released dynamorse as open source so that interested users can try out the project's unique approach, track its progress and provide feedback. This is prototype software that is not yet for production use in its current form. To date, the authors have focused on de-risking the platform as they build from the ground up, proving ideas such as reactive streams with IoT and asynchronous access to media-processing C++ libraries. As a result, many of the dynamorse nodes are not fully functional and - in some cases - not even implemented at all. It is the authors' intention to complete this work. The status of the implementation and the current next-step plan can be viewed via github issues and milestones.

Contributions can be made via pull requests and will be considered by the authors on their merits. Enhancement requests and bug reports should be raised as github issues. For support, to request development priority or for bespoke node development, please contact Streampunk Media.

Dynamorse will remain open-source. Where links are made to commercial 3rd party libraries, such as codec libraries, access to those features will only be available via a professional-grade support contract. The aim is to give user's a choice between patent-free codecs with open-source implementations (VP8, VP9, VC-2, etc) and codecs with associated patents where professional grade implementations are only available commercially (AVCi, HEVC). More details to follow.

# License

This software is released under the Apache 2.0 license. Copyright 2016 Streampunk Media Ltd.
