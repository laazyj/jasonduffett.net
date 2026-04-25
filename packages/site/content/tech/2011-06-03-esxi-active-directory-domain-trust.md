---
title: "VMware ESXi, Active Directory, and domain trusts"
date: 2011-06-03
summary: "Following the work I’ve been doing with getting Domain Admins working across an Active Directory cross-forest trust, I also found a quirk integrating VMware…"
originalUrl: "https://jasonduffett.net/post/6137285032/esxi-active-directory-domain-trust"
originalId: "6137285032"
tags:
  - vmware
  - active-directory
---

Following the work I’ve been doing with getting [Domain Admins working across an Active Directory cross-forest trust](http://jasonduffett.net/post/5448151233/administering-cross-forest-domains-with-a-single-login), I also found a quirk integrating VMware ESXi 4.1 in the same environment…

I had created a Domain Local security group in the remote domain containing the administrators on my local trusted domain. I added permission for this group to VMware ESXi but was still unable to login using credentials from administrators of my local domain. If I created similar permissions for users on the remote domain it worked fine. I couldn’t even see any authentication requests being made to my domain controllers for the login attempts.

Here is the layout I was working with:

- Two domains (in separate forests with a 2-way trust) - DOMAIN1 and DOMAIN2.
- A security group in DOMAIN1 containing my administrators: DOMAIN1\Remote Administrators
- A security group in DOMAIN2 for my ESXi administrators:DOMAIN2\ESXi Administrators
- DOMAIN1\Remote Administrators is a member of DOMAIN2\ESXi Administrators.
- A VMware ESXi 4.1u1 host in DOMAIN2: ESX1.domain2.com

After a bit of trial and error I found that ESXi wasn’t able to recognise users from the trusted domain (DOMAIN1) as members of its local domain (DOMAIN2) groups. So I added the security group from the trusted domain (DOMAIN1\Remote Administrators) directly into ESXi and it was then able to authenticate users from the trusted domain correctly.

Hopefully someone finds this helpful!
