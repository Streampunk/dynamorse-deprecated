Issues found while developing dynamorse:

* Drop frame timecode bit is not set in `rtp-video-rfc4175-1080i5994.pcap`.
* Parity bit not set in timecode values. Probably best to leave it that way!
* Grain flags in 'rtp-video-rfc4175-1080i50.pcap' is 0xa0 - not expecting
  0x20 bit to be set. Prohibited in 'RTP Specification.txt'.
