---
title: "iDoneThis + AlfredApp = daily standup nirvana"
date: 2013-12-13
summary: "I’ve been testing out iDoneThis as a way of steam-lining the reporting for our team’s morning stand-up meetings."
originalUrl: "https://jasonduffett.net/post/69833281829/idonethis-alfredapp-daily-standup-nirvana"
originalId: "69833281829"
tags:
  - idonethis
  - alfredapp
  - postfix
  - mac-os-x
  - gmail
---

I’ve been testing out [iDoneThis](http://idonethis.com) as a way of steam-lining the reporting for our team’s morning stand-up meetings.

It’s a simple concept. It sends you a reminder email each day which you reply to with what you completed, this goes into a daily calendar and a digest is sent to all your team members each morning. There are other useful features too but that’s a good summary.

Previously I was keeping things in a list in [Trello](http://trello.com), but my personal Trello boards were getting out of control so I’m hoping iDoneThis will be a good way of moving some of the clutter elsewhere.

So far, so good. But I wanted to reduce the friction a bit further and found that [Chad Stovern](http://www.digitalnomad.im) had created a workflow for the [Alfred launcher](http://www.alfredapp.com/) (which I friggin’ love). There is a [how-to and download link for it](http://www.digitalnomad.im/idonethis-for-alfred-2-plugin-howto/).

One thing was missing though… It relies on having Postfix properly configured in OS X, which it isn’t out of the box. So here are the instructions you’ll need to configure Postfix to use Gmail as a mail relay…

1. Open a Terminal window
2. sudo vim /etc/postfix/main.cf
3. Add the following lines to the file and save it.

```
# Gmail Relay Configuration relayhost = [smtp.gmail.com]:587 smtp_sasl_auth_enable = yes smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd smtp_sasl_security_options = noanonymous smtp_use_tls = yes smtp_tls_security_level=encrypt tls_random_source = dev:/dev/urandom
```

4. sudo vim /etc/postfix/sasl_passwd
5. Add the following line (use an application-specific password if you have 2-factor authentication enabled on your Google account):

```
[smtp.gmail.com]:587    USERNAME@gmail.com:PASSWORD
```

6. sudo chmod go-rx /etc/postfix/sasl_passwd
7. sudo postmap /etc/postfix/sasl_passwd
8. Test it out… printf “Subject: Testing Postfix” | sendmail -f USERNAME@gmail.com USERNAME@gmail.com

That’s it.. Now sign up for [iDoneThis](http://idonethis.com), install the [Alfred Workflow](http://www.digitalnomad.im/idonethis-for-alfred-2-plugin-howto/) and “**idid Made the stand-up meeting that much quicker & more focussed**”…
