---
title: "So nuget.org is down..."
date: 2012-03-09
summary: "Has your Microsoft dev shop gone on vacation because of the Nuget.org breakdown?"
originalUrl: "https://jasonduffett.net/post/18998144111/nuget-is-down"
originalId: "18998144111"
tags:
  - nuget
  - net
---

Has your Microsoft dev shop gone on vacation because of the [Nuget.org](http://nuget.org/) breakdown?

There are some quick fixes!

**Add your local nuget cache as an alternative package source.**

You probably want to use the same packages you’ve used before & these are hopefully still cached on your PC.
Open the Package Manager Settings dialogue and add a new source:

> %LocalAppData%\NuGet\Cache

![NuGet Package Manager settings dialog for adding a package source](http://i44.tinypic.com/j5ksxd.jpg)

\***\*Or you can edit your **NuGet.Config\*\* file located under C:\Users\_[username]\_\AppData\Roaming\NuGet as follows:

>

The config file won’t expand environment variables so you’ll have to hard code the location of your nuget cache.

**Host your own NuGet feed**

You can setup your own NuGet feed, mirroring packages that you regularly need. See [http://docs.nuget.org/docs/creating-packages/hosting-your-own-nuget-feeds](http://docs.nuget.org/docs/creating-packages/hosting-your-own-nuget-feeds)

**Use a 3rd party to host a NuGet feed for you**

I haven’t tried this yet but it’s something I plan on having a look at in case, heaven forbid, NuGet goes down again!

[http://www.myget.org/](http://www.myget.org/)

**Add the local package source to your NuGet.config**

Have you enabled NuGet Package Restore on your solution?

Open the.nuget/nuget.configsolution file and add the following element:

>

\*\*\*\*_UPDATE: This doesn’t actually work as you expect, unless nuget.config is in the current working directory. Please vote for [this work item](http://nuget.codeplex.com/workitem/1861) to have it work as expected._
