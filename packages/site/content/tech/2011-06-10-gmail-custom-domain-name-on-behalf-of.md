---
title: 'Gmail, custom domain name & "on behalf of..."'
date: 2011-06-10
summary: "I use Gmail for all my different email addresses including some custom domain names."
originalUrl: "https://jasonduffett.net/post/6385048950/gmail-custom-domain-name-on-behalf-of"
originalId: "6385048950"
---

I use Gmail for all my different email addresses including some custom domain names.

One of the annoying things with the default setup is that it includes the “Sender” field in the message, for DomainKeys compatiblity, which some email clients (Outlook & Hotmail for starters) use to display the email as “From myemail@gmail.com on behalf of myemail@mycustomdomain.com”.

This just looks ugly.

The solution is to configure Gmail to use a different SMTP server (eg. from your ISP) to send emails from your custom domain, but not everyone has access to an SMTP server that supports this. For instance Sky’s SMTP server rewrites all messages as coming from your sky.com address.

There is a solution though. Use Gmail’s SMTP servers.

Open Gmail options and edit the account for your custom domain email address and set it up as follows:

- SMTP Server: <strong>smtp.gmail.com</strong>
- Port: <strong>587</strong>
- Username: <em><strong>Your google account (including @gmail.com/@googlemail.com)</strong></em>
- Password: <em><strong>Your google password</strong></em>
- Secured using <strong>TLS</strong>

![Gmail options screenshot](http://i54.tinypic.com/20h97wn.png)

One more thing… If you are using Google’s [2 Step Verification](http://www.google.com/support/accounts/bin/static.py?page=guide.cs&guide=1056283&topic=1056284), then you will need to setup an application-specific password for the Gmail SMTP server and use that instead of your google password.
