

## Funnels

* PCAP files containing RTP packets to incubator specs. Y
* RTP video streams - incubator specs - PGroup. Y
* RTP audio streams - incubator specs. Y
** File - raw essence - long files with chunk size
** Files - raw essence - one grain per file
* SDI video capture - raw essence - V210. Y
** Grain metadata maker
** HTTP grain receiver - pipelined parallel

## Boilers/Valves

* RTP/UDP to Grain. Y
** Buffer and metadata to Grain
* UDP to RTP. Y
** V210 Grain to PGroup Grain
** PGroup Grain to V210 Grain
* Grain to WAV buffer. Y
** Grain to RTP with headers

## Spouts

** Grain file writer - streaming to a single file
** Grain to files - one file per grain
* Buffer dump to file. Y
* RTP/UDP output - PGroup video expected in RTP/UDP output. Y
** Grain metadata writer
** SDI video playback - raw essence - V210
** HTTP grain sender - pipeline parallel
