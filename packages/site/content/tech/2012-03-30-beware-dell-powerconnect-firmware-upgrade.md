---
title: "Beware Dell PowerConnect firmware upgrade"
date: 2012-03-30
summary: "We had a bit of a hair-pulling here at eSpares this morning. The plan was to upgrade the firmware in the Dell PowerConnect 6224 switches in one of our testin…"
originalUrl: "https://jasonduffett.net/post/20172863534/beware-dell-powerconnect-firmware-upgrade"
originalId: "20172863534"
---

We had a bit of a hair-pulling here at [eSpares](http://www.espares.co.uk/) this morning. The plan was to upgrade the firmware in the Dell PowerConnect 6224 switches in one of our testing environments.

Moving from version 3.2.1.3 to **3.3.1.10**. According to the documentation it should’ve been a no-brainer, firmware release notes had nothing of concern, but after applying the update our iSCSI network was inaccessible and VMware was having a fit.

After much aggravation we found the culprit. The firmware upgrade reconfigured some of the ports on the switch, re-enabling STP and changing the VLAN config from untagged to tagged. Re-applied our (source-controlled of course) configurations and it was back up and running.

Nothing is ever as easy or side-effect free as the documentation suggests.

Lesson learned.
