Issues found while developing dynamorse:

* Drop frame timecode bit is not set in 'rtp-video-rfc4175-1080i5994.pcap'.
* Parity bit not set in timecode values. Probably best to leave it that way!
* Grain flags in 'rtp-video-rfc4175-1080i50.pcap' is 0xa0 - not expecting
  0x20 bit to be set. Prohibited in 'RTP Specification.txt'.
* Extended sequence count does not tick over as expected in
  'rtp-video-rfc4175-1080i50-longer-sequence.pcap'. In extended number/sequence
  number pairs, sequence found is (0x0e9a, 0xfffe), (0x0e9b, 0xffff),
  (0x0e9b, 0x0000). Sequence expected is (0x0e9a, 0xfffe), (0x0e9a, 0xffff),
  (0x0e9b, 0x0000). See Wireshark at packet nos 37950-37952. The problem
  also occurs in 'rtp-video-rfc4175-1080i50-sync.pcap'.

Extra:

* How should you determine framerate? From SDP file? Or use grain duration?
* Similarly, how should you determine progressive or interlace?
