---
title: "Domain Admin rights on a cross-forest domain trust"
date: 2011-06-02
summary: "Update 02/06/2011: BUILTIN\\Administrators on the domain controllers is just not enough, see Group Policy…"
originalUrl: "https://jasonduffett.net/post/5448151233/administering-cross-forest-domains-with-a-single-login"
originalId: "5448151233"
tags:
  - active-directory
---

_Update 02/06/2011: BUILTIN\Administrators on the domain controllers is just not enough, see [Group Policy](#grouppolicy)…_

I needed to setup some of our domain administrators as administrators on a new prototype domain we are setting up. There are plenty of resources on setting up trust-relationships between domains in the same forest but what about between two separate, unrelated forests?

Here are the steps I took:

**1. Check your firewalls**

This got me stuck for a while since the egress filter on the firewall at the new site wasn’t allowing all traffic via the VPN. Make sure you are not blocking any traffic between the domain controllers in each forest.

**2. Setup conditional forwarder DNS zones in each network**

You won’t accomplish much if each network can’t properly resolve resources in the other. Adding forwarder zones to your DNS setup in each network allows them to forward DNS requests to the other network’s DNS servers for resources in that network. eg.

> Given the two forests below, we can use the following commands to create forwarder zones for both the forestX.mycompany.com zone and the appropriate reverse lookup zones.
> local_dom.mycompany.com* Subnet: 192.168.1.0/24* DNS servers: 192.168.1.2, 192.168.1.3
> remote_dom.mycompany.com* Subnet: 192.168.2.0/24* DNS servers: 192.168.2.2, 192.168.2.3
> At LOCAL_DOM…

```
dnscmd 192.168.1.2 /ZoneAdd remote_dom.mycompany.com /DsForwarder 192.168.2.2 192.168.2.3

dnscmd 192.168.1.2 /ZoneAdd 2.168.192.in-addr.arpa /DsForwarder 192.168.2.2 192.168.2.3
```

> At REMOTE_DOM…

```
dnscmd 192.168.2.2 /ZoneAdd local_dom.mycompany.com /DsForwarder 192.168.1.2 192.168.1.3

dnscmd 192.168.2.2 /ZoneAdd 1.168.192.in-addr.arpa /DsForwarder 192.168.1.2 192.168.1.3
```

> You can now test it:

```
nslookup dc1.remote_dom.mycompany.com 192.168.1.2

nslookup 192.168.2.2 192.168.1.2

nslookup dc1.local_dom.mycompany.com 192.168.2.2

nslookup 192.168.1.2 192.168.2.2
```

**3. Create a forest-forest trust relationship**

Open the Active Directory Domains and Trusts console (domain.msc) in one of the domains. Go to the properties of the domain and, under the Trusts tab, click New Trust and enter the following details:

- DNS name of the other domain.
- <strong>Forest Trust</strong> - users from any domain in either forest can authenticate in any domain in the other forest.
- <strong>Two-way</strong> relationship
- Create the trust relationship in both domains
- <strong>Forest-wide authentication</strong>
- Once the trust is completed use the wizard to confirm the incoming/outgoing trust.

Users in LOCAL_DOM are now part of Everyone & Authenticated Users in REMOTE_DOM but don’t have many rights to do anything yet… You can verify this by opening Active Directory Users & Computers (dsa.msc) and changing the domain to remote_dom.mycompany.com - you can view, but not modify, the other domain.

**3. Create a security group for administrators of REMOTE_DOM**

Our goal is to have the domain administrators of LOCAL_DOM also administrators of REMOTE_DOM. The first thing to do is to create a security group to manage which users have rights on REMOTE_DOM - call it “REMOTE_DOM Administrators”. Make sure you create the group as either **Global** or **Universal** otherwise it will not be visible to the REMOTE_DOM domain (Domain Local scoped groups are just that, local to the domain).

Add the users who should have rights (or just Domain Admins) to this group.

**4. Grant REMOTE_DOM Administrators rights in the REMOTE_DOM domain**

Now open dsa.msc on the REMOTE_DOM domain. Because Domain Admins is a Global scoped group you won’t be able to add users/groups from LOCAL_DOM to it. To grant the LOCAL_DOM users full administrator rights on the REMOTE_DOM domain you need to add them to the **BUILTIN\Administrators** group which is locally scoped.

Open the group and click Add under the Members tab. Change the location from remote_dom.mycompany.com to local_dom.mycompany.com and add the LOCAL_DOM\REMOTE_DOM Administrators group.

**Setup a Group Policy to grant administrator rights across the domain.**

Although after completing step 4 you’ll have Administrator rights on the domain controller, this just isn’t the same as Domain Admins. The first thing you’ll notice is that you have only user rights on other machines in the domain.

1. 1. Create a domain local group in REMOTE_DOM (eg. REMOTE_DOM\LOCAL_DOM Administrators).
2. 2. Add the security group we created in our local domain (LOCAL_DOM\REMOTE_DOM Administrators) to this group.
3. 3. Open REMOTE_DOM’s Group Policy Management console (gpmc.msc).
4. 4. Create a new Group Policy Object, linked to the route of the REMOTE_DOM domain. Call it “LOCAL_DOM Administrators.”
5. 5. Edit the GPO and find the Preferences \ Control Panel Settings \ Local Users and Groups policy settings.
6. 6. Add an action that will add LOCAL_DOM Administrators as a member of the BUILTIN\Administrators group.

This policy will now be applied to all computers on the domain, granting members of “LOCAL_DOM\REMOTE_DOM Administrators” administrative rights on all machines.

Note: There are still permissions that Domain/Enterprise Admins have that are not granted using this procedure (eg. editing Group Policy Objects). I’m still working through them - any suggestions welcome!
