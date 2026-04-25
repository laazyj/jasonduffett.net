---
title: "Microsoft Key Management Service"
date: 2011-05-19
summary: "Microsoft’s Key Management Service (KMS) is a great way to manage licensing of a large number of machines. All you need is to have a KMS server running on yo…"
originalUrl: "https://jasonduffett.net/post/5633415993/microsoft-key-management-service"
originalId: "5633415993"
tags:
  - active-directory
---

Microsoft’s Key Management Service (KMS) is a great way to manage licensing of a large number of machines. All you need is to have a KMS server running on your network, registered in DNS, and all the latest versions of Windows will activate themselves automatically.

It’s recommended that you have multiple KMS servers on your network, for redundancy, but this can be tricky as a KMS server will not activate any clients until it has a minimum number of PCs contact it for activation (5x server OS, or 25x client OS).

You can use the following commands on 5x Windows 2008 PCs to quickly reach this minimum and activate the KMS server. These commands will first update the KMS server that the PC is using, then re-activate Windows.

```
C:\>cscript c:\Windows\system32\slmgr.vbs /skms fqdn-of-kms-server.mydomain.com

C:\>cscript c:\Windows\system32\slmgr.vbs /ato
```

You will receive the following error until you have activated enough PCs, then they will start activating successfully – at which point you can stop and let windows manage activations automatically again.

> Error: 0xC004F038 The computer could not be activated. The returned count from your Key Management Service is insufficient.

To see the current count of activations on the KMS server:

```
C:\>cscript c:\Windows\system32\slmgr.vbs /dli
```

For more information on KMS see these Technet resources:

- [http://technet.microsoft.com/en-us/library/dd979804.aspx](http://technet.microsoft.com/en-us/library/dd979804.aspx)
- [http://technet.microsoft.com/en-us/library/cc303276.aspx](http://technet.microsoft.com/en-us/library/cc303276.aspx)
