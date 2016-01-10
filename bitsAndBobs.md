

## Funnels

* PCAP files containing RTP packets to incubator specs.
* RTP video streams - incubator specs - PGroup
* RTP audio streams - incubator specs
* File - raw essence - long files with chunk size
* Files - raw essence - one grain per file
* SDI video capture - raw essence - V210
* Grain metadata maker
* HTTP grain receiver - pipelined parallel

## Boilers

* RTP/UDP to Grain
* Buffer and metadata to Grain
* UDP to RTP
* V210 Grain to PGroup Grain
* PGroup Grain to V210 Grain
* Grain to WAV buffer
* Grain to RTP with headers

## Spouts

* Grain file writer - streaming to a single file
* Grain to files - one file per grain
* Buffer dump to file
* RTP/UDP output - PGroup video expected
* Grain metadata writer
* SDI video playback - raw essence - V210
* HTTP grain sender - pipeline parallel
