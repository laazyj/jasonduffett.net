---
title: "Recording deployments in New Relic with PowerShell's Invoke-WebRequest"
date: 2014-04-15
summary: "If you’re not using New Relic to monitor your ASP.NET applications then you definitely should be, it’s an awesome tool providing a huge insight into how your…"
originalUrl: "https://jasonduffett.net/post/82802432966/recording-deployments-in-new-relic-with-powershells"
originalId: "82802432966"
tags:
  - powershell
---

If you’re not using [New Relic](http://newrelic.com/) to monitor your ASP.NET applications then you definitely should be, it’s an awesome tool providing a huge insight into how your application is running in the real world.

One of the useful things you can do is record deployment events in New Relic so you can see the relative performance of different versions of your applications. There is documentation provided for using curl to do this, but we don’t have curl available in our environment. Rather than pushing it out onto the servers I wrote a simple PowerShell script that is included in our deployment process (using the excellent [Octopus Deploy](https://octopusdeploy.com/)).

```powershell
$NewRelicUri = "https://api.newrelic.com/deployments.xml"
$body = @{
    "deployment[application_id]" = "123456";
    "deployment[description]"="This deployment was sent using PowerShell";
    "deployment[revision]"= "2242";
    "deployment[changelog]"= "many hands make light work";
    "deployment[user]"="Your name"
}

Write-Host "Sending notification to $NewRelicUri..."
Invoke-WebRequest -Uri $NewRelicUri `
    -Headers @{ "x-api-key"="aa11bb22bffbbfbf..." } `
    -Method Post `
    -Body $body `
    -UseBasicParsing
```

Replace the different values, including the x-api-key, with the ones appropriate for your application.
