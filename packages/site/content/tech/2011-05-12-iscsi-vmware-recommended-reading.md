---
title: "iSCSI, VMware recommended reading"
date: 2011-05-12
summary: "If you are setting up a VMware environment using iSCSI storage (especially EqualLogic) then I recommend reading these links:"
originalUrl: "https://jasonduffett.net/post/5416982514/iscsi-vmware-recommended-reading"
originalId: "5416982514"
tags:
  - vmware
  - equallogic
---

If you are setting up a VMware environment using iSCSI storage (especially EqualLogic) then I recommend reading these links:

- Michael Ellerbeck’s “So you bought an EqualLogic SAN, now what?” series ([part 1](http://michaelellerbeck.com/2009/11/23/so-you-bought-an-equallogic-san-now-what-part-one/), [part 2](http://michaelellerbeck.com/2009/11/30/so-you-bought-an-equallogic-san-now-what-part-two/), [part 3](http://michaelellerbeck.com/2009/12/08/so-you-bought-an-equallogic-san-now-what-part-three/))
- [A “Multivendor Post” to help our mutual iSCSI customers using VMware](http://virtualgeek.typepad.com/virtual_geek/2009/01/a-multivendor-post-to-help-our-mutual-iscsi-customers-using-vmware.html) (written by experts from VMware, NetApp, EqualLogic, HP/Lefthand and EMC).
- [Configuring VMware vSphere Software iSCSI with Dell EqualLogic PS Series Storage](http://www.equallogic.com/resourcecenter/assetview.aspx?id=8453)

And some tips when configuring your VMware storage…

- Keep your VM swap files with the VM.
- Use shared LUNs, only use a LUN per VM when performance or security requires it.
- Make your shared LUNs at least 500GB.
- Keep a maximum of 15-20 VMs on each LUN.
- Use the Software iSCSI adaptor, jumbo frames aren’t supported in VMware on hardware adaptors and you’ll get much more performance from jumbo-frames than from offloading iSCSI processing to a HBA - [see benchmarks](http://www.vmadmin.co.uk/vmware/35-esxserver/252-esxihwswiscsijumbo).
- But if you need to boot from an iSCSI volume then you’ll have to use a hardware adaptor.
- Set Round-Robin MPIO policy on each volume.

Finally, see my previous post about [configuring VMware ESXi iSCSI software adaptor via PowerShell](http://jasonduffett.net/post/5356826166/iscsi-configuration-for-vmware-esxi).
